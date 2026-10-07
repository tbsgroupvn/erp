// test/quote/quote-service.spec.ts — Task 7: QuoteService CRUD header/item + recalc + phạm vi xem.
import { prisma } from '../helpers/db';
import { resetQuote } from '../helpers/quote-db';
import { resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { QuoteService, CreateQuoteInput } from '../../src/quote/quote.service';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const svc = new QuoteService(prisma as any, scope);

// Header golden case A (xem plan §BỘ SỐ VÀNG, id 66040) — vat_base_full=1,
// entrust_base='both'.
const HEADER_A: CreateQuoteInput = {
  rateRmbVnd: 3960,
  rateUsdVnd: 0,
  rateCnyUsd: 3960,
  fxBufferPct: 0,
  entrustFeePct: 0.03,
  freightVnPerKg: 10000,
  freightVnPerCbm: 1300000,
  entrustBase: 'both',
  currencyMode: 'rmb',
  vatBaseFull: true,
  vatExclService: false,
  paymentMode: 'tra_truoc',
};

// Dòng hàng golden A — input gốc, calcItem() phải ra totalVnd=1134097 (đo
// prod, xem plan mục BỘ SỐ VÀNG dòng A).
const ITEM_A = {
  qty: 10,
  unitPriceRmb: 25.5,
  domesticShipRmb: 0,
  weightKg: 1,
  cbm: 0,
  importTaxPct: 0,
  consumptionTaxPct: 0,
  antidumpingPct: 0,
  envtaxAmount: 0,
  vatPct: 0.08,
};

async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: 'r' + uid + '_' + code + '_' + sc, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

describe('QuoteService', () => {
  beforeEach(async () => {
    await resetQuote();
    await resetIam();
    perm.clearCache();
  });
  afterAll(() => prisma.$disconnect());

  describe('createQuote + addItem', () => {
    it('addItem lưu totalVnd=1134097 (golden A) — đọc lại từ DB, khớp cả biên Decimal↔number', async () => {
      const q = await svc.createQuote(HEADER_A, 'sale1');
      const item = await svc.addItem(q.id, ITEM_A);

      const reread = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(Number(reread.totalVnd)).toBe(1_134_097);
      expect(Number(reread.vatAmount)).toBe(84_007);
      expect(reread.shipBy).toBe('kg');
    });

    it('createQuote sinh quoteCode không rỗng, lưu được', async () => {
      const q = await svc.createQuote(HEADER_A, 'sale1');
      expect(q.quoteCode).toBeTruthy();
      expect(q.createdBy).toBe('sale1');
    });

    // F1 — bẫy idempotency: addItem tính bằng cbm=0.1479 CHƯA làm tròn (input
    // gốc), nhưng nếu cột cbm chỉ giữ 2 số lẻ thì DB lưu 0.15; recalcQuote
    // đọc lại 0.15 từ DB và tính ra totalVnd KHÁC — ngầm đổi số mà không ai
    // đụng vào gì. header A: freightVnPerKg=10000 × weightKg=1 = 10.000,
    // freightVnPerCbm=1.300.000 × cbm=0.1479 = 192.270 -> nhánh cbm THẮNG,
    // nên cbm trực tiếp quyết định shipToVnVnd/totalVnd (không phải nhánh
    // kg vô hại với sai số làm tròn).
    it('⚠⚠ addItem rồi recalcQuote KHÔNG được đổi totalVnd khi cbm có 4 số lẻ và nhánh cbm thắng (F1 idempotency)', async () => {
      const q = await svc.createQuote(HEADER_A, 'sale1');
      const item = await svc.addItem(q.id, { ...ITEM_A, cbm: 0.1479 });

      const before = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(before.cbm.toString()).toBe('0.1479');
      expect(before.shipBy).toBe('cbm');
      const totalBefore = Number(before.totalVnd);

      const n = await svc.recalcQuote(q.id);
      expect(n).toBe(1);

      const after = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(after.cbm.toString()).toBe('0.1479');
      expect(Number(after.totalVnd)).toBe(totalBefore);
    });
  });

  describe('recalcQuote — kết quả là DẪN XUẤT, không phải nhập tay', () => {
    it('đổi tỷ giá header rồi recalcQuote -> dòng hàng đổi theo', async () => {
      const q = await svc.createQuote(HEADER_A, 'sale1');
      const item = await svc.addItem(q.id, ITEM_A);
      const before = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(Number(before.totalVnd)).toBe(1_134_097);

      // Đổi tỷ giá RMB->VND: 3960 -> 4200. amount_rmb không đổi (255), chỉ
      // amount_vnd và mọi thứ derived từ nó phải đổi theo.
      await prisma.quote.update({ where: { id: q.id }, data: { rateRmbVnd: 4200 } });
      const n = await svc.recalcQuote(q.id);
      expect(n).toBe(1);

      const after = await prisma.quoteItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(Number(after.amountVnd)).toBe(255 * 4200); // 1_071_000
      expect(Number(after.totalVnd)).not.toBe(1_134_097);
      expect(Number(after.totalVnd)).toBeGreaterThan(Number(before.totalVnd));
    });

    it('recalcQuote tính lại NHIỀU dòng cùng lúc — CẢ HAI dòng đổi số dẫn xuất, không chỉ dòng đầu', async () => {
      const q = await svc.createQuote(HEADER_A, 'sale1');
      const i1 = await svc.addItem(q.id, ITEM_A);
      const i2 = await svc.addItem(q.id, { ...ITEM_A, qty: 20 });

      const r2Before = await prisma.quoteItem.findUniqueOrThrow({ where: { id: i2.id } });
      const r2EntrustBefore = Number(r2Before.entrustFeeVnd);
      const r2TotalBefore = Number(r2Before.totalVnd);

      await prisma.quote.update({ where: { id: q.id }, data: { entrustFeePct: 0.05 } });
      const n = await svc.recalcQuote(q.id);
      expect(n).toBe(2);

      const r1 = await prisma.quoteItem.findUniqueOrThrow({ where: { id: i1.id } });
      const r2 = await prisma.quoteItem.findUniqueOrThrow({ where: { id: i2.id } });
      expect(Number(r1.entrustFeeVnd)).not.toBe(30294); // đổi entrust_fee_pct -> đổi entrust_fee_vnd

      // ⚠ Khẳng định chính: DÒNG THỨ HAI cũng phải được tính lại — trước đây
      // test này chỉ soi dòng đầu + một cột input (qty) mà recalcQuote không
      // hề đụng tới, nên `expect(n).toBe(2)` không chứng minh gì (n luôn bằng
      // items.length bất kể có tính lại thật hay không — cắt vòng lặp còn
      // `slice(0,1)` vẫn xanh). Soi CỘT DẪN XUẤT của dòng thứ hai.
      expect(Number(r2.entrustFeeVnd)).not.toBe(r2EntrustBefore);
      expect(Number(r2.totalVnd)).not.toBe(r2TotalBefore);
      expect(Number(r2.qty)).toBe(20);
    });
  });

  describe('listForUser — phạm vi #01 ScopeService (owner field = createdBy)', () => {
    it('scope own: chỉ thấy báo giá của chính mình', async () => {
      const u1 = await seedUser({ username: 'sale1' });
      await seedUser({ username: 'sale2' });
      await grant(u1.id, 'quote_view', 'own');

      const qMine = await svc.createQuote(HEADER_A, 'sale1');
      await svc.createQuote(HEADER_A, 'sale2');

      const rows = await svc.listForUser('quote_view', u1.id);
      expect(rows.map((r) => r.id)).toEqual([qMine.id]);
    });

    it('scope all: thấy mọi báo giá', async () => {
      const u1 = await seedUser({ username: 'ktt1' });
      await grant(u1.id, 'quote_view', 'all');
      await svc.createQuote(HEADER_A, 'sale1');
      await svc.createQuote(HEADER_A, 'sale2');

      const rows = await svc.listForUser('quote_view', u1.id);
      expect(rows.length).toBe(2);
    });

    it('không có quyền -> KHÔNG trả gì (fail-closed)', async () => {
      const u1 = await seedUser({ username: 'sale1' });
      await svc.createQuote(HEADER_A, 'sale1');

      const rows = await svc.listForUser('perm_khong_ton_tai', u1.id);
      expect(rows).toHaveLength(0);
    });

    // F2 — scope 'warehouse' là giá trị HỢP LỆ của enum Scope, có thể gán
    // cho bất kỳ quyền nào kể cả 'quote_view'. buildDocScope('warehouse')
    // dựng where trên field mặc định 'storeId' — Quote KHÔNG có cột này (Quote
    // được lọc theo saler=createdBy, không theo kho) ⇒ trước fix, Prisma ném
    // PrismaClientValidationError (500) thay vì trả rỗng. Đây là lỗ NỀN của
    // #01 ScopeService (module #02 CustomerService.listForUser có lỗ y hệt) —
    // vá ở đây là fail-closed, không phải vá #01.
    it('⚠⚠ scope warehouse (Quote không có cột storeId) -> fail-closed [], KHÔNG throw (F2)', async () => {
      const u1 = await seedUser({ username: 'wh1' });
      await grant(u1.id, 'quote_view', 'warehouse');
      await prisma.userScope.create({ data: { userId: u1.id, loai: 'warehouse', giaTri: 'KHO_HN' } });
      await svc.createQuote(HEADER_A, 'sale1');

      await expect(svc.listForUser('quote_view', u1.id)).resolves.toEqual([]);
    });
  });

  describe('quoteCode không bao giờ trùng lặp — F5: định dạng BG-YYYY-MM-NNN khớp prod', () => {
    it('createQuote sinh quoteCode dạng BG-YYYY-MM-<seq>, không phải BG<seq> trần', async () => {
      const a = await svc.createQuote(HEADER_A, 'sale1');
      const b = await svc.createQuote(HEADER_A, 'sale1');
      expect(a.quoteCode).toMatch(/^BG-\d{4}-\d{2}-\d+$/);
      expect(b.quoteCode).toMatch(/^BG-\d{4}-\d{2}-\d+$/);
      expect(a.quoteCode).not.toBe(b.quoteCode);
    });

    // Mirror test/masterdata/customer-code.spec.ts "số ĐÃ PHÁT không tái
    // dùng kể cả khi transaction rollback" — pin invariant NGUYÊN VĂN của
    // comment nextQuoteNum() (SEQUENCE Postgres, nextval() không rollback).
    // Sequence call PHẢI đi qua `tx` để có ý nghĩa (đốt số trên đúng
    // connection của transaction rồi rollback).
    it('số ĐÃ PHÁT không tái dùng kể cả khi transaction rollback (F5 sequence)', async () => {
      const before = await svc.nextQuoteNum();
      await prisma
        .$transaction(async (tx) => {
          await tx.$queryRawUnsafe(`SELECT nextval('quote_code_seq')`);
          throw new Error('rollback');
        })
        .catch(() => {});
      const after = await svc.nextQuoteNum();
      expect(after).toBeGreaterThan(before + 1);
    });
  });
});
