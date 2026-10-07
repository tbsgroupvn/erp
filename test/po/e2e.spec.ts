import { PrismaModule } from '../../src/prisma/prisma.module';
// test/po/e2e.spec.ts — Task 7 #06: e2e qua PoModule THẬT (Test.createTestingModule
// -> app.init()), chứng minh PoModule tự wire đúng (Prisma + ScopeService của
// IamModule) VÀ chứng minh cổng chặn hoá đơn BG↔PO hoạt động đầu-cuối trên
// một PO thật đi qua vòng đời tuần tự, cùng lối `test/quote/e2e.spec.ts`.
//
// Dữ liệu báo giá dùng ĐÚNG golden case A của #05 (id 66040 prod, xem
// docs/rewrite-spec/plans/2026-09-23-06-po-plan.md §BỘ SỐ VÀNG +
// test/quote/calc-item-new.spec.ts + test/quote/e2e.spec.ts): qty=10,
// unitPriceNovatVnd=105_009, baseInvoice(=qty×unitPriceNovatVnd)=1_050_090,
// vatInvoice=84_007, vatPct=0.08, totalVnd(có thuế)=1_134_097 — CHÍNH các
// giá trị mặc định của `seedItem()` (test/helpers/quote-db.ts) đã encode
// nguyên golden A, không cần chạy lại calcItem() ở đây.
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PoModule } from '../../src/po/po.module';
import { PoService } from '../../src/po/po.service';
import { QuotePoDiffService } from '../../src/po/quote-po-diff.service';
import { prisma } from '../helpers/db';
import { resetPo, seedPoItem } from '../helpers/po-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';

let app: INestApplication;
let poSvc: PoService;
let diffSvc: QuotePoDiffService;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, PoModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  poSvc = mod.get(PoService);
  diffSvc = mod.get(QuotePoDiffService);
});

beforeEach(async () => {
  await resetMasterdata();
  await resetQuote();
  await resetPo();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('PoModule e2e — cổng chặn hoá đơn BG↔PO (Task 7 #06)', () => {
  it('golden A khớp PO -> không lệch -> cho xuất hoá đơn -> đổi %VAT PO -> chặn -> chấp nhận chênh -> qua -> đổi báo giá -> chặn lại (chấp nhận cũ KHÔNG còn hiệu lực)', async () => {
    // ── setup: khách hàng + báo giá golden A, liên kết PO qua Quote.poId ──
    const customer = await seedCustomer('TBS9301', 'sale1');
    const quote = await seedQuote('BG-E2E-A', { buyerId: customer.id });
    const quoteItem = await seedItem(quote.id); // defaults = golden A (qty10, unitPriceNovatVnd105009, vatPct0.08, totalVnd1134097)
    expect(Number(quoteItem.totalVnd)).toBe(1_134_097); // khẳng định lại golden A trước khi dùng làm mốc so

    // ── PO đi qua module thật, dòng khớp TỪNG Ô với dòng báo giá ──
    // ⚠⚠⚠ đơn vị %VAT NGƯỢC nhau: PoItem.vatRate là PHẦN TRĂM (8), QuoteItem.vatPct là PHÂN SỐ (0.08).
    const created = await poSvc.createPo({ buyerId: customer.id }, 'sale1');
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('setup');
    const poId = created.po.id;

    await prisma.quote.update({ where: { id: quote.id }, data: { poId } });
    const poItem = await seedPoItem(poId, {
      quoteItemId: quoteItem.id,
      quantity: 10,
      unitPrice: 105_009, // = quoteItem.unitPriceNovatVnd
      amount: 1_050_090, // = quoteItem.baseInvoice (qty × unitPriceNovatVnd)
      vatRate: 8, // = quoteItem.vatPct(0.08) × 100
    });

    // ── vòng đời tuần tự tới status 3 (Đã duyệt) — compare() chỉ "sống" từ đây ──
    const s1 = await poSvc.submit(poId, 'sale1');
    expect(s1.ok).toBe(true);
    const s2 = await poSvc.leaderApprove(poId, 'leader1');
    expect(s2.ok).toBe(true);
    const s3 = await poSvc.tpkdApprove(poId, 'tpkd1');
    expect(s3.ok).toBe(true);
    expect(s3.ok && s3.po.status).toBe(3);

    // ── 1. compare() không lệch; canIssueInvoice ok ──
    const cmp1 = await diffSvc.compare(poId);
    expect(cmp1.hasDiff).toBe(false);
    expect(cmp1.structural).toEqual([]);
    expect(cmp1.rows).toHaveLength(1);
    expect(cmp1.rows[0].cells.vat_rate.diff).toBe(false);
    expect(cmp1.rows[0].cells.vat_money.diff).toBe(false);
    expect(cmp1.rows[0].cells.amount.diff).toBe(false);

    const inv1 = await diffSvc.canIssueInvoice(poId);
    expect(inv1).toEqual({ ok: true });

    // ── 2. đổi %VAT của DÒNG PO (tbl_po_items.vat_rate) 8 -> 10 -> chặn ──
    await prisma.poItem.update({ where: { id: poItem.id }, data: { vatRate: 10 } });

    const cmp2 = await diffSvc.compare(poId);
    expect(cmp2.rows[0].cells.vat_rate.diff).toBe(true);
    expect(cmp2.rows[0].cells.vat_money.diff).toBe(true); // vat_money kéo theo lệch vì %VAT đổi

    const inv2 = await diffSvc.canIssueInvoice(poId);
    expect(inv2.ok).toBe(false);
    expect(inv2.reason).toMatch(/VAT/); // nêu tên ô đang lệch — FIELD_LABEL '%VAT'/'Tiền VAT'

    // ── 3. acceptGap với lý do -> ok true trở lại ──
    const accepted = await diffSvc.acceptGap(poId, 'Đổi %VAT theo chính sách mới, đã đối chiếu', 'kt_truong1');
    expect(accepted.reason).toBe('Đổi %VAT theo chính sách mới, đã đối chiếu');

    const inv3 = await diffSvc.canIssueInvoice(poId);
    expect(inv3).toEqual({ ok: true });

    // ── 4. đổi PHÍA BÁO GIÁ (mã HS) -> bộ số lệch MỚI xuất hiện -> chặn lại ──
    // Chứng minh chấp nhận ở bước 3 KHÔNG "dán nhãn" cho cả PO — nó chỉ khớp
    // ĐÚNG bộ số lệch tại thời điểm ký; đổi thêm một ô khác (dù PO đứng yên)
    // là một bộ số lệch khác, chấp nhận cũ hết hiệu lực ngay.
    await prisma.quoteItem.update({ where: { id: quoteItem.id }, data: { hsCode: 'HS-NEW-CODE' } });

    const cmp4 = await diffSvc.compare(poId);
    expect(cmp4.rows[0].cells.hs_code.diff).toBe(true);
    expect(cmp4.rows[0].cells.vat_rate.diff).toBe(true); // %VAT vẫn lệch như cũ, KHÔNG bị xoá

    const inv4 = await diffSvc.canIssueInvoice(poId);
    expect(inv4.ok).toBe(false);
    expect(inv4.reason).toMatch(/Mã HS/);
  });
});
