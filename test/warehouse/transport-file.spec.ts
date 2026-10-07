import { prisma } from '../helpers/db';
import { resetWarehouse, seedTransportFile } from '../helpers/warehouse-db';
import { TransportFileService } from '../../src/warehouse/transport-file.service';

const svc = new TransportFileService(prisma as any);

// ⚠ Mapping trạng thái (SUY RA từ mốc, không nhập tay — brief Task 4):
//   0 = chưa có mốc nào · 1 = đã packDate · 2 = đã runDate ·
//   3 = đã arrivalDate · 4 = đã clearanceDate.
//   Đo prod 23/09/2026: 14 cont, status chỉ có 0 (10 dòng) và 1 (4 dòng) —
//   status 2/3/4 là đường CHƯA có dữ liệu thật.
describe('TransportFileService — trạng thái suy từ mốc + khoá thông quan (#07 Task 4)', () => {
  beforeEach(async () => {
    await resetWarehouse();
  });
  afterAll(() => prisma.$disconnect());

  describe('mốc thời gian -> status suy ra', () => {
    it('đặt từng mốc theo thứ tự -> status tiến đúng 0 -> 1 -> 2 -> 3 -> 4', async () => {
      const created = await svc.createFile({ fileCode: 'CONT-001' }, 'nv1');
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error('setup');
      const fileId = created.file.id;

      let reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(reread.status).toBe(0);

      await svc.setPackDate(fileId, new Date('2026-09-01'));
      reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(reread.status).toBe(1);

      await svc.setRunDate(fileId, new Date('2026-09-05'));
      reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(reread.status).toBe(2);

      await svc.setArrivalDate(fileId, new Date('2026-09-10'));
      reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(reread.status).toBe(3);

      await svc.setClearanceDate(fileId, new Date('2026-09-12'));
      reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(reread.status).toBe(4);
    });
  });

  describe('customsLock() chặn nạp kiện/hàng', () => {
    it('sau khi khoá, loadPackage bị từ chối VÀ KHÔNG ghi gì (đếm trước/sau)', async () => {
      const file = await seedTransportFile();
      const lock = await svc.customsLock(file.id, 'kt1');
      expect(lock.ok).toBe(true);

      const before = await prisma.transportFilePackage.count({ where: { fileId: file.id } });
      const r = await svc.loadPackage(file.id, { packageCode: 'PKG-001', weight: '10' });
      expect(r.ok).toBe(false);
      const after = await prisma.transportFilePackage.count({ where: { fileId: file.id } });
      expect(after).toBe(before);
    });

    it('sau khi khoá, loadItem bị từ chối VÀ KHÔNG ghi gì (đếm trước/sau)', async () => {
      const file = await seedTransportFile();
      const lock = await svc.customsLock(file.id, 'kt1');
      expect(lock.ok).toBe(true);

      const before = await prisma.transportFileItem.count({ where: { fileId: file.id } });
      const r = await svc.loadItem(file.id, { productName: 'Áo thun', quantity: '10' });
      expect(r.ok).toBe(false);
      const after = await prisma.transportFileItem.count({ where: { fileId: file.id } });
      expect(after).toBe(before);
    });

    it('TRƯỚC khi khoá, loadPackage/loadItem vẫn ghi được bình thường', async () => {
      const file = await seedTransportFile();
      const r1 = await svc.loadPackage(file.id, { packageCode: 'PKG-OK' });
      const r2 = await svc.loadItem(file.id, { productName: 'X' });
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
    });
  });

  describe('customsLock() nguyên tử', () => {
    it('khoá hai lần -> lần hai bị từ chối, KHÔNG ghi đè customsLockedBy/customsLockedAt gốc', async () => {
      const file = await seedTransportFile();
      const first = await svc.customsLock(file.id, 'kt1');
      expect(first.ok).toBe(true);

      const afterFirst = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(afterFirst.customsLockedBy).toBe('kt1');
      expect(afterFirst.customsLockedAt).not.toBeNull();

      // Đợi 1 giây thật để customsLockedAt (giây) chắc chắn KHÁC nếu bị ghi đè.
      await new Promise((res) => setTimeout(res, 1100));

      const second = await svc.customsLock(file.id, 'kt2');
      expect(second.ok).toBe(false);

      const afterSecond = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(afterSecond.customsLockedBy).toBe('kt1');
      expect(afterSecond.customsLockedAt).toBe(afterFirst.customsLockedAt);
    });

    it('⚠ ép race THẬT bằng transaction giữ lock — updateMany atomic, đúng 1 người thắng', async () => {
      const file = await seedTransportFile();
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      const txA = prisma.$transaction(async (tx) => {
        const r = await tx.transportFile.updateMany({
          where: { id: file.id, customsLocked: 0 },
          data: { customsLocked: 1, customsLockedBy: 'SLOW' },
        });
        await sleep(250);
        return r.count;
      });

      await sleep(50);
      const countB = (
        await prisma.transportFile.updateMany({
          where: { id: file.id, customsLocked: 0 },
          data: { customsLocked: 1, customsLockedBy: 'FAST' },
        })
      ).count;

      const countA = await txA;
      expect(countA).toBe(1);
      expect(countB).toBe(0);

      const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(reread.customsLockedBy).toBe('SLOW');
    });

    // ⚠⚠⚠ F5 (review cuối #07): bài test NGAY TRÊN gọi
    // `prisma.transportFile.updateMany` TRỰC TIẾP ở cả hai vế — nó pin
    // NGUYÊN LIỆU của Prisma (updateMany tự thân nguyên tử), không pin
    // `svc.customsLock`. Test đó vẫn xanh 100% ngay cả khi `customsLock()`
    // bị lùi về check-then-act (findUnique -> kiểm -> update({where:{id}})),
    // vì nó không hề gọi qua service. Bài test dưới đây gọi THẲNG
    // `svc.customsLock()` làm vế thua cuộc — đây mới là net thực sự canh
    // service, không phải canh nguyên liệu Prisma.
    it('⚠⚠ F5 — svc.customsLock() (KHÔNG PHẢI updateMany thô) là vế thua khi tranh chấp lock thật', async () => {
      const file = await seedTransportFile();
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      // txA: mở transaction, updateMany (giữ row lock), rồi NGỦ trước khi commit.
      const txA = prisma.$transaction(async (tx) => {
        const r = await tx.transportFile.updateMany({
          where: { id: file.id, customsLocked: 0 },
          data: { customsLocked: 1, customsLockedBy: 'SLOW' },
        });
        await sleep(250);
        return r.count;
      });

      // Đợi đủ để txA chắc chắn đã updateMany xong (đang giữ lock trong lúc
      // ngủ) trước khi gọi svc.customsLock() làm vế thứ hai.
      await sleep(50);
      const resultB = await svc.customsLock(file.id, 'FAST');

      const countA = await txA;
      expect(countA).toBe(1);
      // Nếu customsLock() là check-then-act: findUnique() không bị chặn bởi
      // lock của txA (SELECT thường không chờ FOR UPDATE/row lock ở READ
      // COMMITTED), đọc thấy customsLocked=0 (bản CHƯA commit của txA vẫn vô
      // hình), qua guard, rồi update({where:{id}}) KHÔNG điều kiện — câu này
      // bị CHẶN THẬT bởi lock của txA, nhưng khi txA commit xong nó vẫn ghi
      // ĐÈ (không có where:{customsLocked:0} để tự chặn) -> trả ok:true SAI.
      // Với updateMany({where:{id,customsLocked:0}}) đúng: sau khi txA
      // commit (customsLocked đã thành 1), WHERE không còn khớp -> count=0
      // -> ok:false. Đây chính là khẳng định phân biệt hai cách cài.
      expect(resultB.ok).toBe(false);

      const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(reread.customsLockedBy).toBe('SLOW');
    });
  });

  describe('mốc thời gian ảnh hưởng tờ khai bị khoá sau customsLock', () => {
    // Quyết định: packDate/runDate là mốc mô tả ĐÃ đóng gói gì và ĐÃ chạy khi
    // nào — đó là gốc của tờ khai hải quan (cargo manifest). Sửa lại hai mốc
    // này SAU khi khoá tức sửa lại lịch sử làm nền cho tờ khai đã nộp -> phải
    // từ chối. arrivalDate/clearanceDate là các mốc XẢY RA SAU khi khoá trong
    // vòng đời thật của cont (khoá tờ khai rồi cont mới cập cảng rồi mới
    // thông quan xong) -> vẫn phải ghi được để cont đi tiếp, không "đóng
    // băng" luôn cả hành trình.
    it('sau khoá, setPackDate bị từ chối VÀ KHÔNG ghi', async () => {
      const file = await seedTransportFile({ packDate: new Date('2026-09-01') });
      await svc.customsLock(file.id, 'kt1');
      const before = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });

      const r = await svc.setPackDate(file.id, new Date('2026-09-02'));
      expect(r.ok).toBe(false);

      const after = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(after.packDate?.getTime()).toBe(before.packDate?.getTime());
    });

    it('sau khoá, setRunDate bị từ chối VÀ KHÔNG ghi', async () => {
      const file = await seedTransportFile();
      await svc.customsLock(file.id, 'kt1');

      const r = await svc.setRunDate(file.id, new Date('2026-09-05'));
      expect(r.ok).toBe(false);

      const after = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(after.runDate).toBeNull();
    });

    it('sau khoá, setArrivalDate/setClearanceDate VẪN ghi được (không ảnh hưởng nội dung tờ khai)', async () => {
      const file = await seedTransportFile();
      await svc.customsLock(file.id, 'kt1');

      const rArrival = await svc.setArrivalDate(file.id, new Date('2026-09-10'));
      expect(rArrival.ok).toBe(true);
      const rClearance = await svc.setClearanceDate(file.id, new Date('2026-09-12'));
      expect(rClearance.ok).toBe(true);

      const after = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(after.arrivalDate).not.toBeNull();
      expect(after.clearanceDate).not.toBeNull();
      expect(after.status).toBe(4);
    });
  });

  describe('syncStatus() idempotent', () => {
    it('gọi hai lần liên tiếp không đổi gì thêm', async () => {
      const file = await seedTransportFile({ packDate: new Date('2026-09-01'), runDate: new Date('2026-09-05') });
      const first = await svc.syncStatus(file.id);
      expect(first.ok).toBe(true);
      const afterFirst = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(afterFirst.status).toBe(2);

      const second = await svc.syncStatus(file.id);
      expect(second.ok).toBe(true);
      const afterSecond = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      expect(afterSecond.status).toBe(2);
      expect(afterSecond).toEqual(afterFirst);
    });

    // ⚠⚠ F4 (review cuối #07): bản đầu là check-then-act thuần (findUnique ->
    // tính status -> update({where:{id}}) KHÔNG điều kiện) — kịch bản cắn
    // thật: syncStatus(7) đọc thấy packDate (tính status=1); TRƯỚC KHI update
    // của nó chạy, setClearanceDate(7,...) xen vào, commit clearanceDate VÀ
    // status=4; syncStatus ghi status=1 ĐÈ LÊN, cont hiện "đã đóng gói" dù
    // clearanceDate đã có. Ép race thật bằng transaction giữ FOR UPDATE lock
    // (đúng khuôn setMilestone() dùng) trong lúc syncStatus() đọc-rồi-ghi —
    // KẾT QUẢ CUỐI CÙNG (không phải trình tự đọc) phải phản ánh mốc MỚI NHẤT.
    it('⚠⚠ F4 — svc.syncStatus() KHÔNG ghi đè status khi một mốc khác (giữ FOR UPDATE lock) xen vào giữa đọc và ghi', async () => {
      const file = await seedTransportFile({ packDate: new Date('2026-09-01') }); // status suy ra = 1
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      // txA mô phỏng ĐÚNG setClearanceDate(): giữ FOR UPDATE lock, ghi
      // clearanceDate + status=4, rồi NGỦ trước khi commit (lock vẫn giữ).
      const txA = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM tbl_transport_files WHERE id = ${file.id} FOR UPDATE`;
        await tx.transportFile.update({
          where: { id: file.id },
          data: { clearanceDate: new Date('2026-09-12'), status: 4 },
        });
        await sleep(250);
      });

      // Đợi đủ để txA đã lấy lock + ghi xong (đang ngủ, còn giữ lock).
      await sleep(50);
      const result = await svc.syncStatus(file.id);
      await txA;

      expect(result.ok).toBe(true);
      const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
      // Bất kể syncStatus() đọc TRƯỚC hay bị chặn tới SAU khi txA commit,
      // status CUỐI CÙNG phải là 4 (mốc mới nhất) — KHÔNG được kẹt ở 1 (bản
      // suy từ packDate, cũ trước khi clearanceDate được set). Với check-
      // then-act, updateMany() ở đây sẽ là update() không điều kiện: bị chặn
      // bởi lock của txA, rồi khi txA commit vẫn ghi ĐÈ status=1 (đã tính từ
      // TRƯỚC lúc đọc), làm reread.status = 1 SAI.
      expect(reread.status).toBe(4);
      expect(reread.clearanceDate).not.toBeNull();
    });
  });
});
