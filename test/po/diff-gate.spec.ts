// Task 5 #06 — coLechChan / hash / acceptGap / canIssueInvoice: cổng chặn
// xuất hoá đơn GTGT khi PO và báo giá đã duyệt mâu thuẫn nhau, cùng cơ chế
// "chấp nhận chênh" bám ĐÚNG bộ số đang lệch (không bám PO). Xem contract ở
// docs/rewrite-spec/plans/2026-09-23-06-po-plan.md mục "⚠ Hợp đồng
// `quote_po_diff`" + khối comment "Task 5" đầu src/po/quote-po-diff.service.ts.
import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoItem } from '../helpers/po-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';
import {
  QuotePoDiffService,
  coLechChan,
  normalizeNumForHash,
  GapReasonRequired,
  GapNoLinkedQuote,
  GapNoBlockingDiff,
} from '../../src/po/quote-po-diff.service';
import { PoStatus } from '../../src/po/po.constants';

const svc = new QuotePoDiffService(prisma as any);

describe('QuotePoDiffService — Task 5 cổng chặn hoá đơn #06', () => {
  beforeEach(async () => {
    await resetPo();
    await resetQuote();
  });
  afterAll(() => prisma.$disconnect());

  // ═══ normalizeNumForHash — chuẩn hoá số trước khi băm ═══════════════
  describe('normalizeNumForHash', () => {
    it('"17.000" (chấm ngăn cách nghìn kiểu VN) và "17000" (số thuần) ra cùng một chuỗi chuẩn hoá', () => {
      expect(normalizeNumForHash('17.000')).toBe(normalizeNumForHash('17000'));
      expect(normalizeNumForHash('17.000')).toBe('17000');
    });

    it('nhóm nghìn nhiều cấp "1.234.567" chuẩn hoá đúng về "1234567"', () => {
      expect(normalizeNumForHash('1.234.567')).toBe('1234567');
    });

    it('đuôi thập phân .0 thừa bị rụng: "17.0" ≡ "17"', () => {
      expect(normalizeNumForHash('17.0')).toBe(normalizeNumForHash('17'));
      expect(normalizeNumForHash('17.0')).toBe('17');
    });

    it('số có phần thập phân THẬT (không phải .0/.00) giữ nguyên, không bị hiểu nhầm thành ngăn cách nghìn', () => {
      expect(normalizeNumForHash('8.5')).toBe('8.5');
    });

    it('nhận number thuần (không chỉ string)', () => {
      expect(normalizeNumForHash(17000)).toBe('17000');
    });
  });

  // ═══ Test 1 — lệch CHỈ ở ô cảnh báo không chặn ═══════════════════════
  it('lệch CHỈ ở product_name ⇒ hasDiff=true nhưng coLechChan=false ⇒ canIssueInvoice vẫn ok:true (07/09/2026 cố ý không chặn 2 ô cảnh báo)', async () => {
    const po = await seedPo('PO-GATE-WARNONLY', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-WARNONLY', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08,
      hsCode: 'HS1', origin: 'CN', nameVn: 'Áo thun cotton', unit: 'cái',
    });
    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
      hsCode: 'HS1', origin: 'CN', productName: 'Áo thun', unit: 'cái', // tên khác quote — CHỈ ô này lệch
    });

    const cmp = await svc.compare(po.id);
    expect(cmp.rows[0].cells.product_name.diff).toBe(true);
    expect(cmp.hasDiff).toBe(true); // Task 4: hasDiff tính CẢ ô cảnh báo
    expect(coLechChan(cmp)).toBe(false); // Task 5: coLechChan CHỈ tính 7 ô chặn

    const gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true });
  });

  // ═══ Test 2 — CA THEN CHỐT: hash bám bộ-số-lệch, không bám PO ════════
  it('chấp nhận chênh xong, đổi PHÍA BÁO GIÁ sinh lệch MỚI (PO đứng yên) ⇒ canIssueInvoice phải CHẶN LẠI vì hash đổi', async () => {
    const po = await seedPo('PO-GATE-BIND', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-BIND', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08, // %VAT quote = 8
      hsCode: 'HS1', origin: 'CN', nameVn: 'Áo', unit: 'cái',
    });
    const poItem = await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000,
      vatRate: 10, // PO 10% vs quote 8% -> lệch CHẶN (vat_rate + vat_money)
      hsCode: 'HS1', origin: 'CN', productName: 'Áo', unit: 'cái',
    });

    // Bước 1: chưa ai chấp nhận -> chặn.
    let gate = await svc.canIssueInvoice(po.id);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('%VAT');

    // Bước 2: chấp nhận chênh hiện tại (vat_rate/vat_money) — có lý do.
    const hashBefore = await svc.hash(po.id);
    await svc.acceptGap(po.id, 'Đã đối chiếu, chênh VAT do làm tròn, chấp nhận', 'huytq8995');

    gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true });

    // Bước 3: KHÔNG đụng PO — chỉ đổi phía BÁO GIÁ (hsCode), sinh độ lệch
    // MỚI trên chính dòng đã ghép cặp. Nếu hash bị bám vào riêng PO (hoặc
    // vào PoItem.id/PurchaseOrder.id thay vì vào NỘI DUNG số đang lệch) thì
    // bước này sẽ KHÔNG làm hash đổi, và cổng sẽ (sai) tiếp tục cho ok:true
    // dù con số chênh hiện tại (vat_rate/vat_money + hs_code) không còn là
    // con số mà 'huytq8995' đã thấy và ký ở Bước 2. Test này CHỈ xanh khi
    // hash được tính lại từ compare() hiện tại, không phải đọc lại giá trị
    // đã lưu ở Bước 2.
    await prisma.quoteItem.update({ where: { id: qi.id }, data: { hsCode: 'HS2' } });
    expect(poItem.hsCode).toBe('HS1'); // xác nhận PO KHÔNG đổi

    const hashAfter = await svc.hash(po.id);
    expect(hashAfter).not.toBe(hashBefore); // bộ số lệch đã khác

    gate = await svc.canIssueInvoice(po.id);
    expect(gate.ok).toBe(false); // CHẶN LẠI — đúng cái test này tồn tại để bắt
    expect(gate.reason).toContain('Mã HS');
  });

  // ═══ Test 3 — reason bắt buộc ═════════════════════════════════════════
  it('acceptGap với reason rỗng hoặc toàn khoảng trắng bị từ chối và KHÔNG ghi gì', async () => {
    const po = await seedPo('PO-GATE-NOREASON', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-NOREASON', { poId: po.id });
    const qi = await seedItem(quote.id, { qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08 });
    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 90000, amount: 900000, vatRate: 8, // đơn giá lệch -> có gì đó để "chấp nhận"
    });

    await expect(svc.acceptGap(po.id, '', 'huy')).rejects.toThrow(GapReasonRequired);
    await expect(svc.acceptGap(po.id, '   ', 'huy')).rejects.toThrow(GapReasonRequired);

    const rows = await prisma.poDiffAcceptance.findMany({ where: { poId: po.id } });
    expect(rows).toHaveLength(0); // đọc lại kho để xác nhận không ghi gì

    // cổng vẫn chặn vì chưa có chấp nhận hợp lệ nào lọt qua.
    const gate = await svc.canIssueInvoice(po.id);
    expect(gate.ok).toBe(false);
  });

  // ═══ Test 4 — hash bỏ qua ô cảnh báo ═════════════════════════════════
  it('hash KHÔNG đổi khi chỉ ô cảnh báo (product_name) đổi giá trị — chấp nhận cũ vẫn còn hiệu lực', async () => {
    const po = await seedPo('PO-GATE-WARNIGNORE', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-WARNIGNORE', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08, nameVn: 'Áo thun',
    });
    const poItem = await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 90000, amount: 900000, vatRate: 8, // lệch CHẶN ở unit_price/amount
      productName: 'Áo thun', // khớp quote lúc đầu — chưa lệch cảnh báo
    });

    const hashBefore = await svc.hash(po.id);
    await svc.acceptGap(po.id, 'Chấp nhận chênh đơn giá do đàm phán lại', 'huytq8995');
    let gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true });

    // Đổi CHỈ ô cảnh báo — productName phía PO lệch với quote.
    await prisma.poItem.update({ where: { id: poItem.id }, data: { productName: 'Áo thun cổ tròn' } });

    const hashAfter = await svc.hash(po.id);
    expect(hashAfter).toBe(hashBefore); // hash KHÔNG đổi — ô cảnh báo không góp phần

    gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true }); // chấp nhận cũ vẫn đứng vững
  });

  // ═══ Test 5 — F6 CA THEN CHỐT: D→E→D, chỉ đọc chấp nhận MỚI NHẤT ═════
  // Bug cũ: canIssueInvoice tìm KHẮP LỊCH SỬ poDiffAcceptance
  // (findFirst({poId, hash:currentHash})) thay vì chỉ đọc bản ghi MỚI NHẤT
  // và đòi CHÍNH NÓ khớp — sản xuất (`qpd_accepted()`) chỉ đọc gần nhất.
  // Kịch bản: chấp nhận bộ lệch D (hash HD) -> sửa báo giá sinh lệch MỚI E
  // (HE) -> sửa báo giá LẦN NỮA quay đúng về D (hash lại thành HD, vì hash
  // bám NỘI DUNG đang lệch). Bug cũ: dòng HD cũ (Bước 1) vẫn còn trong bảng
  // -> "tìm khắp lịch sử" thấy khớp -> lọt SAI, đè lên chủ ý của bản chấp
  // nhận E (Bước 2, MỚI HƠN, ai đó đã cố tình không ký D lần 2). Bản vá: chỉ
  // đọc bản ghi MỚI NHẤT (id desc) — bản mới nhất là chấp nhận E (hash HE),
  // so với hash hiện tại (đã quay về HD) -> KHÔNG khớp -> CHẶN ĐÚNG, đòi ký
  // lại dù nội dung số y hệt lúc D từng được chấp nhận.
  it('⚠⚠⚠ F6 — D→E→D: chấp nhận D, sửa sinh E, sửa quay lại D ⇒ canIssueInvoice CHẶN (chỉ đọc chấp nhận MỚI NHẤT, không tìm khắp lịch sử)', async () => {
    const po = await seedPo('PO-GATE-DED', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-DED', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08,
      hsCode: 'HS-D', origin: 'CN', nameVn: 'Áo', unit: 'cái',
    });
    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
      hsCode: 'HS-PO', origin: 'CN', productName: 'Áo', unit: 'cái', // hsCode lệch CHẶN với quote
    });

    // Bước 1 — chấp nhận bộ lệch D (hsCode quote = 'HS-D').
    const hashD = await svc.hash(po.id);
    await svc.acceptGap(po.id, 'Chấp nhận lệch mã HS lần 1 (D)', 'huytq8995');
    let gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true });

    // Bước 2 — sửa báo giá sinh lệch MỚI E (hsCode quote = 'HS-E'), rồi
    // CHẤP NHẬN CHÍNH E — đây là chủ ý MỚI NHẤT, người ký đã thấy đúng E.
    await prisma.quoteItem.update({ where: { id: qi.id }, data: { hsCode: 'HS-E' } });
    const hashE = await svc.hash(po.id);
    expect(hashE).not.toBe(hashD);
    await svc.acceptGap(po.id, 'Chấp nhận lệch mã HS lần 2 (E)', 'huytq8995');
    gate = await svc.canIssueInvoice(po.id);
    expect(gate).toEqual({ ok: true });

    // Bước 3 — báo giá bị sửa LẦN NỮA, quay đúng về nội dung D (hsCode quote
    // trở lại 'HS-D') — KHÔNG ai chấp nhận lại D lần này. Hash quay lại đúng
    // HD (hash bám nội dung, không bám thời điểm).
    await prisma.quoteItem.update({ where: { id: qi.id }, data: { hsCode: 'HS-D' } });
    const hashBack = await svc.hash(po.id);
    expect(hashBack).toBe(hashD);

    // Chấp nhận MỚI NHẤT trong bảng vẫn là của E (Bước 2) — không khớp hash
    // hiện tại (đã quay về D) ⇒ PHẢI chặn, dù dòng chấp nhận D (Bước 1) vẫn
    // còn nằm trong bảng.
    gate = await svc.canIssueInvoice(po.id);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('Mã HS');
  });

  // ═══ Test 6 — F6 acceptGap từ chối khi KHÔNG có báo giá liên kết ═════
  it('⚠ F6 — acceptGap từ chối khi PO chưa có báo giá liên kết (compare().quoteId === null), KHÔNG ghi gì', async () => {
    const po = await seedPo('PO-GATE-NOQUOTE', { status: PoStatus.DA_DUYET });
    // Không seedQuote với poId: po.id -> compare() trả quoteId=null.

    await expect(svc.acceptGap(po.id, 'thử chấp nhận khi chưa có báo giá', 'huy')).rejects.toThrow(
      GapNoLinkedQuote,
    );

    const rows = await prisma.poDiffAcceptance.findMany({ where: { poId: po.id } });
    expect(rows).toHaveLength(0);
  });

  // ═══ Test 7 — F6 acceptGap từ chối khi KHÔNG có ô CHẶN nào lệch ═════
  it('⚠ F6 — acceptGap từ chối khi báo giá đã khớp PO (coLechChan=false), KHÔNG ghi gì', async () => {
    const po = await seedPo('PO-GATE-NODIFF', { status: PoStatus.DA_DUYET });
    const quote = await seedQuote('BG-GATE-NODIFF', { poId: po.id });
    const qi = await seedItem(quote.id, {
      qty: 10, unitPriceNovatVnd: 100000, vatPct: 0.08,
      hsCode: 'HS1', origin: 'CN', nameVn: 'Áo', unit: 'cái',
    });
    // Mọi ô CHẶN khớp tuyệt đối với quote — không có gì để chấp nhận.
    await seedPoItem(po.id, {
      sortOrder: 1, quoteItemId: qi.id,
      quantity: 10, unitPrice: 100000, amount: 1000000, vatRate: 8,
      hsCode: 'HS1', origin: 'CN', productName: 'Áo', unit: 'cái',
    });

    const cmp = await svc.compare(po.id);
    expect(coLechChan(cmp)).toBe(false); // xác nhận tiền đề: không có lệch CHẶN

    await expect(svc.acceptGap(po.id, 'không có gì để chấp nhận', 'huy')).rejects.toThrow(
      GapNoBlockingDiff,
    );

    const rows = await prisma.poDiffAcceptance.findMany({ where: { poId: po.id } });
    expect(rows).toHaveLength(0);
  });
});
