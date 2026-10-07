import { prisma, resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetWarehouse, seedKhoTqReceipt } from '../helpers/warehouse-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { KhoTqReceiptService } from '../../src/warehouse/khotq-receipt.service';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const svc = new KhoTqReceiptService(prisma as any, scope);

// Không dùng seedRole dùng chung (nó tách permCode bằng dấu '.') — 'kho_view'
// không có dấu chấm nên tách hỏng. Mirror test/masterdata/customer-scope.spec.ts.
let seq = 0;
async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: `r${uid}_${code}_${sc}_${seq++}`, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

async function grantWarehouse(uid: number, khoList: string[]) {
  await grant(uid, 'khotq_view', 'warehouse');
  for (const k of khoList) {
    await prisma.userScope.create({ data: { userId: uid, loai: 'warehouse', giaTri: k } });
  }
}

describe('KhoTqReceiptService — nhận kho TQ + phạm vi kho (#07 Task 2)', () => {
  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetWarehouse();
  });
  afterAll(() => prisma.$disconnect());

  // ═══ receive() — 3 nguồn thật ═══════════════════════════════════════════
  describe('receive()', () => {
    it("nguồn 'lark' với customerId lưu đúng", async () => {
      const r = await svc.receive({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001', trackingCode: 'TRK-1' }, 'nv1');
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error('setup');
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
      expect(reread.source).toBe('lark');
      expect(reread.kho).toBe('TQ_NGHIAO');
      expect(reread.customerId).toBe('TBS0001');
    });

    it("nguồn 'po_scan' với customerId lưu đúng", async () => {
      const r = await svc.receive({ source: 'po_scan', kho: 'TQ_BANGTUONG', customerId: 'TBS0002' }, 'nv1');
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error('setup');
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
      expect(reread.source).toBe('po_scan');
      expect(reread.customerId).toBe('TBS0002');
    });

    it("nguồn 'unclaimed' KHÔNG có customerId vẫn thành công (hàng chưa có chủ)", async () => {
      const r = await svc.receive({ source: 'unclaimed', kho: 'TQ_NGHIAO' }, 'nv1');
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error('setup');
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
      expect(reread.source).toBe('unclaimed');
      expect(reread.customerId).toBeNull();
    });

    it("nguồn KHÁC 'unclaimed' thiếu customerId -> từ chối, KHÔNG ghi dòng nào", async () => {
      const before = await prisma.khoTqReceipt.count();
      const r = await svc.receive({ source: 'lark', kho: 'TQ_NGHIAO' }, 'nv1');
      expect(r.ok).toBe(false);
      const after = await prisma.khoTqReceipt.count();
      expect(after).toBe(before);
    });

    it('thiếu kho -> từ chối, KHÔNG ghi dòng nào', async () => {
      const before = await prisma.khoTqReceipt.count();
      const r = await svc.receive({ source: 'lark', customerId: 'TBS0001' } as any, 'nv1');
      expect(r.ok).toBe(false);
      const after = await prisma.khoTqReceipt.count();
      expect(after).toBe(before);
    });

    it('thiếu source -> từ chối, KHÔNG ghi dòng nào', async () => {
      const before = await prisma.khoTqReceipt.count();
      const r = await svc.receive({ kho: 'TQ_NGHIAO', customerId: 'TBS0001' } as any, 'nv1');
      expect(r.ok).toBe(false);
      const after = await prisma.khoTqReceipt.count();
      expect(after).toBe(before);
    });
  });

  // ═══ claimUnclaimed() — đường chưa từng chạy thật trên prod ═════════════
  // ⚠ prod đo 234 dòng source='unclaimed' và 0 dòng 'claimed' — luồng nhận
  // chủ CHƯA TỪNG chạy thật ngoài đời. Bộ test này là chỗ DUY NHẤT phủ nó.
  describe('claimUnclaimed()', () => {
    it("dòng 'unclaimed' được nhận chủ -> chuyển 'claimed' + gán customerId", async () => {
      const seeded = await seedKhoTqReceipt({ source: 'unclaimed', kho: 'TQ_NGHIAO' });
      const r = await svc.claimUnclaimed(seeded.id, 'TBS0009', 'kt1');
      expect(r.ok).toBe(true);
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: seeded.id } });
      expect(reread.source).toBe('claimed');
      expect(reread.customerId).toBe('TBS0009');
    });

    it("dòng nguồn KHÁC 'unclaimed' -> từ chối, dòng KHÔNG bị đụng vào", async () => {
      const seeded = await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
      const r = await svc.claimUnclaimed(seeded.id, 'TBS0009', 'kt1');
      expect(r.ok).toBe(false);
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: seeded.id } });
      expect(reread.source).toBe('lark');
      expect(reread.customerId).toBe('TBS0001');
    });

    it('receiptId không tồn tại -> từ chối', async () => {
      const r = await svc.claimUnclaimed(999999, 'TBS0009', 'kt1');
      expect(r.ok).toBe(false);
    });

    // ⚠⚠ Vá F.race (fix round): production (`libs/cls.khovn.php:2478-2484`,
    // cùng thao tác trên bảng kho VN) đã tự canh trước — hai người có thể
    // cùng thấy "chưa có chủ" và cùng bấm nhận cùng lúc; UPDATE nguyên tử với
    // `WHERE id=$rid AND source='unclaimed'` đảm bảo chỉ MỘT người thắng.
    // Bản đầu của service này là check-then-act (findUnique rồi mới update)
    // và thua bẫy y hệt: người thứ hai âm thầm đè customerId người thứ nhất.
    //
    // ⚠ ĐỘ MẠNH CỦA TEST NÀY: gọi `svc.claimUnclaimed` hai lần qua
    // `Promise.all` KHÔNG chứng minh được hai câu UPDATE thực sự chồng lên
    // nhau ở tầng Postgres trong lượt chạy cụ thể này — với code ĐÃ SỬA đúng,
    // "đúng một người thắng" vẫn đúng bất kể hai lời gọi có thực sự interleave
    // hay Node/connection-pool tình cờ chạy chúng gần như tuần tự. Test này
    // chỉ xác nhận HỢP ĐỒNG của service (đúng 1 ok:true, customerId lưu lại
    // khớp người thắng), không tự nó chứng minh có race THẬT xảy ra.
    it('hai lời gọi claimUnclaimed đồng thời trên CÙNG phiếu, khách KHÁC nhau -> đúng 1 thắng, DB lưu đúng người thắng', async () => {
      const seeded = await seedKhoTqReceipt({ source: 'unclaimed', kho: 'TQ_NGHIAO' });

      const [r1, r2] = await Promise.all([
        svc.claimUnclaimed(seeded.id, 'TBS_A', 'kt1'),
        svc.claimUnclaimed(seeded.id, 'TBS_B', 'kt2'),
      ]);

      const results = [r1, r2];
      const winners = results.filter((r) => r.ok);
      const losers = results.filter((r) => !r.ok);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const winnerCustomer = r1.ok ? 'TBS_A' : 'TBS_B';
      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: seeded.id } });
      expect(reread.source).toBe('claimed');
      // Phần quan trọng nhất: DB phải lưu đúng KHÁCH CỦA NGƯỜI THẮNG, không
      // phải bị người thua ghi đè (đọc lại từ DB, không suy diễn từ return).
      expect(reread.customerId).toBe(winnerCustomer);
    });

    // ⚠ Test QUYẾT ĐỊNH LUẬN (thay vì hy vọng race xảy ra ngẫu nhiên): ép
    // Postgres THỰC SỰ chặn câu UPDATE thứ hai bằng row lock của một
    // transaction tường minh đang mở — không phải suy đoán từ lịch trình
    // Node. Dùng ĐÚNG mẫu `updateMany({where:{id, source:'unclaimed'}})` mà
    // service dùng để chứng minh chính cái CÂU LỆNH đó nguyên tử dưới tranh
    // chấp DB thật, không chỉ dưới giả định "coi như nó nguyên tử".
    it('⚠ ép race THẬT ở tầng Postgres bằng transaction tường minh giữ lock — chứng minh determinism, không chỉ hy vọng', async () => {
      const seeded = await seedKhoTqReceipt({ source: 'unclaimed', kho: 'TQ_NGHIAO' });
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      // txA: mở transaction, UPDATE (giữ row lock), rồi NGỦ trước khi commit
      // — trong lúc ngủ, transaction vẫn giữ lock trên dòng vừa sửa.
      const txA = prisma.$transaction(async (tx) => {
        const r = await tx.khoTqReceipt.updateMany({
          where: { id: seeded.id, source: 'unclaimed' },
          data: { source: 'claimed', customerId: 'TBS_SLOW' },
        });
        await sleep(250);
        return r.count;
      });

      // Đợi đủ để chắc chắn txA đã UPDATE xong (đang giữ lock, còn trong lúc
      // ngủ) trước khi txB khởi động — nếu không, txB có thể may mắn chạy
      // trước cả txA và test mất tính quyết định luận.
      await sleep(50);
      const countB = (
        await prisma.khoTqReceipt.updateMany({
          where: { id: seeded.id, source: 'unclaimed' },
          data: { source: 'claimed', customerId: 'TBS_FAST' },
        })
      ).count;

      const countA = await txA;
      // txB PHẢI bị Postgres CHẶN THẬT (đợi lock của txA) rồi mới được chạy —
      // lúc đó txA đã commit, predicate 'unclaimed' không còn khớp -> txB
      // khớp 0 dòng. Đây không phải suy đoán: hành vi khoá-dòng của Postgres
      // đảm bảo thứ tự này mỗi lần chạy.
      expect(countA).toBe(1);
      expect(countB).toBe(0);

      const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: seeded.id } });
      expect(reread.customerId).toBe('TBS_SLOW');
    });
  });

  // ═══ listForUser() — ca quan trọng nhất: phạm vi kho fail-closed ════════
  describe('listForUser() — phạm vi kho', () => {
    it('NV gán kho TQ_NGHIAO chỉ thấy phiếu kho đó, KHÔNG thấy TQ_BANGTUONG', async () => {
      const a = await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
      const b = await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_BANGTUONG', customerId: 'TBS0002' });

      const u = await seedUser({ username: 'nv1' });
      await grantWarehouse(u.id, ['TQ_NGHIAO']);

      const rows = await svc.listForUser('khotq_view', u.id);
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(a.id);
      expect(ids).not.toContain(b.id);
    });

    it('quyền warehouse nhưng CHƯA gán kho nào (không có UserScope) -> rỗng, KHÔNG phải thấy tất cả', async () => {
      await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
      await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_BANGTUONG', customerId: 'TBS0002' });

      const u = await seedUser({ username: 'nv2' });
      await grant(u.id, 'khotq_view', 'warehouse'); // KHÔNG seed UserScope

      const rows = await svc.listForUser('khotq_view', u.id);
      expect(rows).toHaveLength(0);
    });

    // ⚠ Bài học 23/09: `buildDocScope` nhánh warehouse là OPT-IN — quên truyền
    // `{ warehouse: 'kho' }` cũng DENY y hệt "chưa gán kho". Bài test TRƯỚC
    // (rỗng vì chưa gán kho) không phân biệt được hai nguyên nhân. Bài test
    // NÀY mới là cái phân biệt: user ĐÃ được gán kho hợp lệ mà vẫn rỗng thì
    // đích thị service quên truyền cột kho, không phải do thiếu gán.
    it('NV ĐÃ được gán kho hợp lệ -> danh sách KHÔNG được rỗng (chặn regressions quên truyền {warehouse:"kho"})', async () => {
      await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });

      const u = await seedUser({ username: 'nv3' });
      await grantWarehouse(u.id, ['TQ_NGHIAO']);

      const rows = await svc.listForUser('khotq_view', u.id);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('permission không tồn tại/không được cấp -> rỗng (fail-closed)', async () => {
      await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
      const u = await seedUser({ username: 'nv4' });
      const rows = await svc.listForUser('perm_khong_ton_tai', u.id);
      expect(rows).toHaveLength(0);
    });

    // ⚠⚠⚠ F3 (review cuối #07): trước bản vá, cấp `khotq_view` ở scope
    // own/team/dept/dept_tree cho MỘT user làm `buildDocScope` dựng where
    // `{ saler: ... }` — KhoTqReceipt không có cột đó -> Prisma ném
    // `PrismaClientValidationError` -> `listForUser` NÉM LỖI (500), không
    // phải trả rỗng. Cùng lớp bug với `storeId` đã vá 23/09/2026, chiều
    // ngược. Test dưới đây KHÔNG kiểm "đúng nghĩa nghiệp vụ" (chưa có quyết
    // định nghiệp vụ cho own/team ở model này — xem comment trên
    // `listForUser`) — nó chỉ khẳng định `listForUser` PHẢI RESOLVE, không
    // được throw, và (theo quyết định đã chọn) resolve về RỖNG.
    describe('scope own/team/dept KHÔNG có cột hợp lệ trên model này -> resolve rỗng, KHÔNG throw', () => {
      it("scope 'own' -> resolves([]) thay vì ném PrismaClientValidationError", async () => {
        await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
        const u = await seedUser({ username: 'nv5' });
        await grant(u.id, 'khotq_view', 'own');

        await expect(svc.listForUser('khotq_view', u.id)).resolves.toEqual([]);
      });

      it("scope 'team' -> resolves([]) thay vì ném PrismaClientValidationError", async () => {
        await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
        const u = await seedUser({ username: 'nv6' });
        await grant(u.id, 'khotq_view', 'team');

        await expect(svc.listForUser('khotq_view', u.id)).resolves.toEqual([]);
      });

      it("scope 'dept' -> resolves([]) thay vì ném PrismaClientValidationError", async () => {
        await seedKhoTqReceipt({ source: 'lark', kho: 'TQ_NGHIAO', customerId: 'TBS0001' });
        const u = await seedUser({ username: 'nv7' });
        await grant(u.id, 'khotq_view', 'dept');

        await expect(svc.listForUser('khotq_view', u.id)).resolves.toEqual([]);
      });
    });
  });
});
