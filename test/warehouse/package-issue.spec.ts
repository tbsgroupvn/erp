import { prisma } from '../helpers/db';
import { resetWarehouse, seedPackageIssue } from '../helpers/warehouse-db';
import { PackageIssueService } from '../../src/warehouse/package-issue.service';

const svc = new PackageIssueService(prisma as any);

// ⚠⚠⚠ §4.10 đòi vòng đời BẮT BUỘC theo thứ tự: mới -> ack -> đóng. Đo CHÍNH
// XÁC trên prod 23/09/2026: 1.464 sự cố kiện, 1.457 đã ACK, và ĐÚNG 0 đã
// ĐÓNG — nửa "đóng" của luật này CHƯA TỪNG chạy thật ngoài đời. Bộ test này
// (đặc biệt nhóm 'close() từ chối khi chưa ack' và 'countUnclosed()') là nơi
// DUY NHẤT phủ đường đó — đọc con số 0/1.464 đừng hiểu nhầm là "đã kiểm
// chứng bằng dữ liệu thật", vì nó chưa hề được kiểm chứng ngoài các test này.
describe('PackageIssueService — ack -> đóng, đếm sự cố còn treo (#07 Task 5)', () => {
  beforeEach(async () => {
    await resetWarehouse();
  });
  afterAll(() => prisma.$disconnect());

  describe('vòng đời tuần tự: raise -> ack -> close', () => {
    it('raise() rồi ack() rồi close() — mỗi bước re-read từ DB', async () => {
      const raised = await svc.raise(501, { khau: 'tren_cont', reasons: 'móp kiện', note: 'phát hiện lúc bốc' }, 'nv1');
      expect(raised.ok).toBe(true);
      if (!raised.ok) throw new Error('setup');
      const issueId = raised.issue.id;

      const afterRaise = await prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
      expect(afterRaise.packageId).toBe(501);
      expect(afterRaise.khau).toBe('tren_cont');
      expect(afterRaise.reasons).toBe('móp kiện');
      expect(afterRaise.createdBy).toBe('nv1');
      expect(afterRaise.ackAt).toBeNull();
      expect(afterRaise.closedAt).toBeNull();

      const acked = await svc.ack(issueId, 'kt1', 'đã kiểm tra thực tế');
      expect(acked.ok).toBe(true);

      const afterAck = await prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
      expect(afterAck.ackBy).toBe('kt1');
      expect(afterAck.ackAt).not.toBeNull();
      expect(afterAck.ackNote).toBe('đã kiểm tra thực tế');
      expect(afterAck.closedAt).toBeNull();

      const closed = await svc.close(issueId, 'kt_truong1', 'đã bồi thường xong');
      expect(closed.ok).toBe(true);

      const afterClose = await prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
      expect(afterClose.closedBy).toBe('kt_truong1');
      expect(afterClose.closedAt).not.toBeNull();
      expect(afterClose.closeNote).toBe('đã bồi thường xong');
    });
  });

  describe('close() từ chối khi chưa ack', () => {
    it('close() một sự cố CHƯA ack -> từ chối VÀ KHÔNG ghi gì (re-read, không tin return)', async () => {
      const seeded = await seedPackageIssue(502, { khau: 'tren_cont', createdBy: 'nv1', createdAt: 1000 });
      expect(seeded.ackAt).toBeNull();

      const r = await svc.close(seeded.id, 'kt_truong1', 'thử đóng thẳng');
      expect(r.ok).toBe(false);

      const reread = await prisma.packageIssue.findUniqueOrThrow({ where: { id: seeded.id } });
      expect(reread.closedAt).toBeNull();
      expect(reread.closedBy).toBeNull();
      expect(reread.closeNote).toBeNull();
      expect(reread.ackAt).toBeNull();
    });
  });

  describe('nguyên tử — double-ack / double-close bị từ chối, không ghi đè', () => {
    it('ack() lần hai -> từ chối, actor/timestamp GỐC không bị ghi đè', async () => {
      const raised = await svc.raise(503, {}, 'nv1');
      if (!raised.ok) throw new Error('setup');

      const first = await svc.ack(raised.issue.id, 'kt1');
      expect(first.ok).toBe(true);
      const afterFirst = await prisma.packageIssue.findUniqueOrThrow({ where: { id: raised.issue.id } });
      expect(afterFirst.ackBy).toBe('kt1');
      expect(afterFirst.ackAt).not.toBeNull();

      const second = await svc.ack(raised.issue.id, 'kt2');
      expect(second.ok).toBe(false);

      const afterSecond = await prisma.packageIssue.findUniqueOrThrow({ where: { id: raised.issue.id } });
      expect(afterSecond.ackBy).toBe('kt1');
      expect(afterSecond.ackAt).toEqual(afterFirst.ackAt);
    });

    it('close() lần hai -> từ chối, actor/timestamp GỐC không bị ghi đè', async () => {
      const raised = await svc.raise(504, {}, 'nv1');
      if (!raised.ok) throw new Error('setup');
      await svc.ack(raised.issue.id, 'kt1');

      const first = await svc.close(raised.issue.id, 'kt_truong1');
      expect(first.ok).toBe(true);
      const afterFirst = await prisma.packageIssue.findUniqueOrThrow({ where: { id: raised.issue.id } });
      expect(afterFirst.closedBy).toBe('kt_truong1');
      expect(afterFirst.closedAt).not.toBeNull();

      const second = await svc.close(raised.issue.id, 'kt_truong2');
      expect(second.ok).toBe(false);

      const afterSecond = await prisma.packageIssue.findUniqueOrThrow({ where: { id: raised.issue.id } });
      expect(afterSecond.closedBy).toBe('kt_truong1');
      expect(afterSecond.closedAt).toEqual(afterFirst.closedAt);
    });

    // ⚠⚠⚠ F5 (review cuối #07): các test double-ack/double-close ở trên gọi
    // hai lần `svc.ack`/`svc.close` tuần tự qua `await` — KHÔNG chứng minh
    // được service còn nguyên tử dưới tranh chấp DB THẬT (một `findUnique ->
    // kiểm -> update` tuần tự vẫn xanh y hệt vì lần gọi thứ hai LUÔN thấy
    // trạng thái đã ack/đã đóng của lần gọi thứ nhất — race chỉ lộ ra khi
    // hai lời gọi THỰC SỰ xen kẽ ở tầng Postgres). Hai test dưới đây ép race
    // thật bằng transaction tường minh giữ lock (cùng khuôn
    // `khotq-receipt.spec.ts`/`transport-file.spec.ts`), gọi THẲNG
    // `svc.ack()`/`svc.close()` làm vế thứ hai — không phải `updateMany` thô.
    it('⚠⚠ F5 — svc.ack() (KHÔNG PHẢI updateMany thô) là vế thua khi tranh chấp lock thật', async () => {
      const raised = await svc.raise(801, {}, 'nv1');
      if (!raised.ok) throw new Error('setup');
      const issueId = raised.issue.id;
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      const txA = prisma.$transaction(async (tx) => {
        const r = await tx.packageIssue.updateMany({
          where: { id: issueId, ackAt: null },
          data: { ackBy: 'SLOW', ackAt: 1000 },
        });
        await sleep(250);
        return r.count;
      });

      await sleep(50);
      const resultB = await svc.ack(issueId, 'FAST');

      const countA = await txA;
      expect(countA).toBe(1);
      // check-then-act sẽ đọc ackAt=null (bản chưa commit của txA vô hình
      // với SELECT thường), qua guard, rồi update({where:{id}}) KHÔNG điều
      // kiện -> bị chặn bởi lock của txA nhưng vẫn ghi ĐÈ sau khi txA commit,
      // trả ok:true SAI. updateMany({where:{id,ackAt:null}}) đúng: sau khi
      // txA commit (ackAt đã có giá trị), WHERE không còn khớp -> count=0.
      expect(resultB.ok).toBe(false);

      const reread = await prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
      expect(reread.ackBy).toBe('SLOW');
    });

    it('⚠⚠ F5 — svc.close() (KHÔNG PHẢI updateMany thô) là vế thua khi tranh chấp lock thật', async () => {
      const raised = await svc.raise(802, {}, 'nv1');
      if (!raised.ok) throw new Error('setup');
      const issueId = raised.issue.id;
      const acked = await svc.ack(issueId, 'kt1');
      expect(acked.ok).toBe(true);
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      const txA = prisma.$transaction(async (tx) => {
        const r = await tx.packageIssue.updateMany({
          where: { id: issueId, ackAt: { not: null }, closedAt: null },
          data: { closedBy: 'SLOW', closedAt: 2000 },
        });
        await sleep(250);
        return r.count;
      });

      await sleep(50);
      const resultB = await svc.close(issueId, 'FAST');

      const countA = await txA;
      expect(countA).toBe(1);
      expect(resultB.ok).toBe(false);

      const reread = await prisma.packageIssue.findUniqueOrThrow({ where: { id: issueId } });
      expect(reread.closedBy).toBe('SLOW');
    });
  });

  describe('countUnclosed()', () => {
    it('đếm đúng across mix raised / acked / closed', async () => {
      const a = await seedPackageIssue(601, { createdBy: 'nv1', createdAt: 1 }); // raised only
      const b = await seedPackageIssue(602, { createdBy: 'nv1', createdAt: 1 }); // will ack
      const c = await seedPackageIssue(603, { createdBy: 'nv1', createdAt: 1 }); // will ack + close
      await seedPackageIssue(604, { createdBy: 'nv1', createdAt: 1 }); // raised only

      await svc.ack(b.id, 'kt1');
      await svc.ack(c.id, 'kt1');
      await svc.close(c.id, 'kt_truong1');

      const count = await svc.countUnclosed();
      // a, b, d còn treo (3) — c đã đóng, không tính.
      expect(count).toBe(3);

      const stillThere = await prisma.packageIssue.findUniqueOrThrow({ where: { id: a.id } });
      expect(stillThere.closedAt).toBeNull();
    });

    // ⚠⚠⚠ Ghi lại con số đo THẬT trên prod 23/09/2026 (xem plan mục "⚠ ĐO
    // PROD" + docs/rewrite-spec/migration/07-kho.md): 1.464 sự cố kiện tồn
    // tại, 1.457 đã ACK, và ĐÚNG 0 (KHÔNG MỘT) đã ĐÓNG — tất cả từ khâu
    // `tren_cont`. Nghĩa là nếu chạy `countUnclosed()` trên CSDL prod thật
    // hôm nay, kết quả sẽ là 1.464 — bằng đúng tổng số sự cố, vì chưa có
    // dòng nào từng đi qua close(). Test dưới đây KHÔNG chạy trên prod (không
    // ai được phép làm vậy — xem luật dự án "test ghi CSDL phải chặn trên
    // prod") — nó chỉ mô phỏng lại đúng tỉ lệ đó trên CSDL test để một người
    // đọc sau còn thấy con số 1.464/1.457/0 có ý nghĩa gì trong ngữ cảnh của
    // countUnclosed(), và để khẳng định rằng nếu ai đó vô tình sửa hỏng nửa
    // "đóng" thì con số đếm sẽ lại nhảy vọt giống hệt tình trạng prod hôm nay.
    it('mô phỏng đúng tỉ lệ đo được trên prod (1.464 sự cố / 1.457 đã ack / 0 đã đóng) -> countUnclosed() vẫn đếm đúng', async () => {
      const TOTAL = 20; // thu nhỏ quy mô prod (1.464) để test chạy nhanh, GIỮ NGUYÊN tỉ lệ ack.
      const ACKED = 19; // tỉ lệ ack/total ~99,5% trên prod (1.457/1.464).
      const CLOSED = 0; // đúng thực trạng đo được — nửa "đóng" chưa từng chạy.

      const issues = [];
      for (let i = 0; i < TOTAL; i++) {
        issues.push(await seedPackageIssue(700 + i, { khau: 'tren_cont', createdBy: 'nv1', createdAt: 1 }));
      }
      for (let i = 0; i < ACKED; i++) {
        const r = await svc.ack(issues[i].id, 'kt1');
        expect(r.ok).toBe(true);
      }
      for (let i = 0; i < CLOSED; i++) {
        await svc.close(issues[i].id, 'kt_truong1');
      }

      const count = await svc.countUnclosed();
      expect(count).toBe(TOTAL - CLOSED); // = TOTAL vì CLOSED=0, đúng thực trạng prod: 0 đã đóng.
    });
  });
});
