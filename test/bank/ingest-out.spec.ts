// 09c L3, Task 2 — BankIngestService: chiều `out` (nội bộ / khớp phiếu chi / ẩn khỏi hàng chờ),
// chiều `in` nội bộ, gán khách tự động 3 tầng (port NGUYÊN VĂN `api/bank-sepay-hook.php:86-321`, prod HEAD 81c96d0)
// + sửa mang từ review Task 1 (replayFrom: mốc ≤ 0 ⇒ ném; bỏ qua giao dịch đã có BẤT KỲ dòng sổ bank_tx).
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §5.5, §10.3, §12 (#10, #11).
//
// ⛔ Số tài khoản ở đây đều GIẢ (`ZZFAKE…`) — không in STK ở bất cứ đâu (§12.13).
import { Logger } from '@nestjs/common';
import { prisma, resetDb } from '../helpers/db';
import { resetTreasury, seedFundAccount } from '../helpers/treasury-db';
import { resetFxBank, seedBankChiMatch, seedBankTransaction } from '../helpers/fx-bank-db';
import { resetApproval, seedTemplate } from '../helpers/approval-db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { GlService } from '../../src/money/gl.service';
import { GlMapService } from '../../src/money/gl-map.service';
import { TreasuryService } from '../../src/money/treasury.service';
import {
  BankIngestError,
  BankIngestService,
  SepayPayload,
  _chuanHoa as C,
} from '../../src/bank/bank-ingest.service';

const treasury = new TreasuryService(prisma as any);
const gl = new GlService(prisma as any);
const glMap = new GlMapService(prisma as any, gl);
const svc = new BankIngestService(prisma as any, treasury, glMap);

const STK1 = 'ZZFAKE001'; // → TK01
const STK3 = 'ZZFAKE003'; // → TK03

const NOTE_NBO_OUT = 'Tu dong: Chuyen tien noi bo giua cac TK ngan hang cong ty';
const NOTE_OUT_ALL = 'Tu dong: giao dich tru tien - an khoi hang cho /bank, giu de doi soat';
const NOTE_NB_IN = 'Tu phan Nap noi bo theo noi dung CK';
// replayFrom(mốc, trần) — trần BẮT BUỘC (final review M2); ca test dùng trần rất cao = "đến hết".
const DEN = 2_000_000_000;

let seq = 0;
function pl(over: Partial<SepayPayload> & Record<string, unknown> = {}): SepayPayload {
  seq++;
  return {
    id: 'ZZ' + seq,
    gateway: 'ACB',
    transactionDate: '2026-09-25 14:02:37',
    accountNumber: STK1,
    transferType: 'out',
    transferAmount: 2000000,
    content: 'thanh toan',
    ...over,
  } as SepayPayload;
}

let tplId = 0;
async function seedKhach(code: string, isactive = 1) {
  return prisma.customer.create({ data: { code, name: code, cdate: 0, mdate: 0, isactive } });
}
async function seedPhieuChi(formData: unknown, o: { status?: number; isDeleted?: boolean; templateId?: number } = {}) {
  const r = await prisma.approvalRequest.create({
    data: {
      templateId: o.templateId ?? tplId,
      objectType: 'phieu_chi_tbs_master',
      objectId: 0,
      currentStepOrder: 1,
      status: o.status ?? 2,
      submittedBy: 'zztest',
      submittedAt: 0,
      isDeleted: o.isDeleted ?? false,
      formData: typeof formData === 'string' || formData === null ? (formData as string | null) : JSON.stringify(formData),
    },
  });
  return r.id;
}
/** Lịch sử ĐÃ gán khách (tầng 2/3 quét `cus_id` khác NULL/''). */
async function seedLichSu(tranMess: string, cusId: string | null, n = 1) {
  for (let i = 0; i < n; i++) {
    await seedBankTransaction({ bankid: '', tranType: '+', tranAmount: BigInt(1000), tranMess, cusId });
  }
}
async function bt(id: number) {
  return prisma.bankTransaction.findUniqueOrThrow({ where: { id: BigInt(id) } });
}
async function details(id: number) {
  return prisma.bankTransactionDetail.findMany({ where: { tranId: BigInt(id) }, orderBy: { id: 'asc' } });
}
async function khongGhiVi() {
  expect(await prisma.walletEntry.count()).toBe(0);
  expect(await prisma.wallet.count()).toBe(0);
}

async function datLai() {
  await resetDb();
  await resetTreasury();
  await resetFxBank();
  await resetMasterdata();
  await resetApproval();
  await seedFundAccount('TK01', { currency: 'VND', stk: STK1, glAccount: '1121' });
  await seedFundAccount('TK03', { currency: 'VND', stk: STK3, glAccount: '138' });
  await prisma.glMapping.create({
    data: { bizType: 'bank_tien_ve', bizLabel: 'bank_tien_ve', debitAccount: '1121', creditAccount: '338', moneySide: 'debit', isApproved: true, active: true },
  });
  tplId = (await seedTemplate('phieu_chi_tbs_master', { objectType: 'phieu_chi_tbs_master' })).id;
}
beforeEach(datLai);
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await resetDb();
  await resetTreasury();
  await resetFxBank();
  await resetMasterdata();
  await resetApproval();
  await prisma.$disconnect();
});

// ═════════════════════════════ chuẩn hoá — từng bước, tiếng Việt ═════════════════════════════
describe('bỏ dấu "noi bo" (:98-101) — mb_strtolower → str_replace bảng dấu → [^a-z0-9]+ → trim', () => {
  test('HOA có dấu ⇒ thường không dấu; ký tự ngoài a-z0-9 ⇒ 1 khoảng', () => {
    expect(C.khongDau('Chuyển tiền NỘI BỘ: TK01 → TK03!!')).toBe('chuyen tien noi bo tk01 tk03');
    expect(C.khongDau('ĐẶNG Ỹ ƯỚC ƠN')).toBe('dang y uoc on');
    expect(C.khongDau('  nạp   nội-bộ  ')).toBe('nap noi bo');
  });
  test('bảng dấu = bản chép NGUYÊN VĂN $dauNBO/$khgNBO (67 cặp, từng vị trí)', () => {
    // chép tay lại từ prod-sepay-hook-86-321.php.txt dòng 98-99 (độc lập với mã nguồn service)
    const DAU = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
    const KHG = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
    expect([...C.BANG_DAU]).toEqual(Array.from(DAU));
    expect([...C.BANG_KHONG_DAU]).toEqual(Array.from(KHG));
    expect(C.BANG_DAU).toHaveLength(67);
  });
  test('dạng tổ hợp NFD KHÔNG có trong bảng ⇒ không bỏ được dấu (prod cũng vậy)', () => {
    const nfd = 'no\u0323\u0302i bo\u0323\u0302'; // "nội bộ" tách dấu
    expect(C.khongDau(nfd)).toBe('no i bo');
    expect(C.khongDau(nfd).includes('noi bo')).toBe(false);
  });
});

describe('mã khách /TBS[\\s\\-\\.]?(\\d{1,6})/i (không cờ u)', () => {
  test.each([
    ['ck TBS-0077 tien hang', 'TBS0077'],
    ['tbs.45 thanh toan', 'TBS45'],
    ['Tbs 12', 'TBS12'],
    ['TBS1234567', 'TBS123456'],
    ['abc TBSx TBS\t9', 'TBS9'],
  ])('%s ⇒ %s', (s, code) => {
    expect(C.maTBS(s)).toBe(code);
  });
  test.each([['TBS--12'], ['TBSx'], ['TBS\u00A012 (NBSP không phải \\s ASCII)'], ['T B S 12']])('%s ⇒ null', (s) => {
    expect(C.maTBS(s)).toBeNull();
  });
});

describe('"vân tay" nội dung (:252-257) — từng bước', () => {
  test('bước 1 cắt đuôi /[\\s\\-]GD[\\s\\-][0-9A-Za-z].*$/u', () => {
    expect(C.catGD('NGUYỄN VĂN AN chuyển tiền-GD 123ABC xyz')).toBe('NGUYỄN VĂN AN chuyển tiền');
    expect(C.catGD('Trần Bình GD-x9')).toBe('Trần Bình');
    expect(C.catGD('Trần Bình gd 12')).toBe('Trần Bình gd 12'); // phân biệt HOA/thường
    expect(C.catGD('Trần BìnhGD 12')).toBe('Trần BìnhGD 12'); // cần dấu cách/gạch TRƯỚC GD
    expect(C.catGD('Trần Bình\u00A0GD 1x')).toBe('Trần Bình'); // cờ u ⇒ \s gồm NBSP (UCP)
    expect(C.catGD('Trần Bình\u0085GD 1x')).toBe('Trần Bình'); // UCP \s gồm NEL
    expect(C.catGD('Trần Bình GD 1x\nthêm')).toBe('Trần Bình GD 1x\nthêm'); // . không qua \n, $ không khớp giữa chuỗi
    expect(C.catGD('Trần Bình GD 1x\n')).toBe('Trần Bình\n'); // $ khớp trước \n cuối
    expect(C.catGD('Trần Bình GD 1x\rđuôi')).toBe('Trần Bình'); // . của PCRE khớp \r
  });
  test('bước 2 mb_strtolower (PHP 8.2: KHÔNG có sigma cuối từ)', () => {
    expect(C.thuong('ĐẶNG THỊ ÁNH')).toBe('đặng thị ánh');
    expect(C.thuong('ΑΣ')).toBe('ασ'); // JS toLowerCase cho 'ας'
  });
  test('bước 3–5: số ⇒ khoảng; [^a-zà-ỹđ ]+ theo code point ⇒ khoảng; gộp khoảng ASCII + trim PHP', () => {
    expect(C.chuKy('ĐẶNG THỊ ÁNH chuyển tiền đơn 0912-GD 88ABC')).toBe('đặng thị ánh chuyển tiền đơn');
    expect(C.chuKy('Ω lô #12 € ỵ')).toBe('ω lô ỵ'); // ω U+03C9 nằm trong dải à..ỹ; € ngoài dải
    expect(C.chuKy('Ỻ abc')).toBe('abc'); // ỻ U+1EFB > ỹ U+1EF9 ⇒ bị bỏ
    expect(C.chuKy('xin chao ban\u1680')).toBe('xin chao ban\u1680'); // U+1680 trong dải, trim PHP không cắt
  });
  test('bước 6 cắt 60 KÝ TỰ (mb_substr) — chỉ vân tay tầng 2, tầng 3 lịch sử KHÔNG cắt', () => {
    const s = 'ệ'.repeat(70);
    expect(Array.from(C.chuKy(s))).toHaveLength(60);
    expect(C.chuKy(s)).toBe('ệ'.repeat(60));
    expect(C.chuKy(s, false)).toBe('ệ'.repeat(70));
  });
  test('tên người gửi: bỏ từ pháp nhân/stop-word, từ đầu ≥ 5 KÝ TỰ', () => {
    expect(C.tenNguoiGui('cong ty tnhh hoang long thanh toan')).toBe('hoang');
    expect(C.tenNguoiGui('nguyễn văn an')).toBe('nguyễn');
    expect(C.tenNguoiGui('trần văn an')).toBe(''); // 'trần' 4 ký tự (5 byte)
    expect(C.tenNguoiGui('cty an phat')).toBe('');
    expect(C.tenNguoiGui('')).toBe('');
  });
  test('(float) kiểu PHP cho so_tien', () => {
    expect(C.phpFloat(2000000)).toBe(2000000);
    expect(C.phpFloat('2000000')).toBe(2000000);
    expect(C.phpFloat(' 2000000.0abc')).toBe(2000000);
    expect(C.phpFloat('2.000.000')).toBe(2);
    expect(C.phpFloat('1e6')).toBe(1000000);
    expect(C.phpFloat('abc')).toBe(0);
    expect(C.phpFloat(true)).toBe(1);
    expect(C.phpFloat([])).toBe(0);
    expect(C.phpFloat([5])).toBe(1);
    expect(C.phpFloat(undefined)).toBe(0);
  });
});

// ═════════════════════════════ chiều out ═════════════════════════════
describe('out + "noi bo" (:96-131)', () => {
  test('⇒ detail type 2 auto + type=2/status=yes; KHÔNG khớp phiếu chi dù có phiếu đúng tiền; 0 sổ, 0 GL', async () => {
    await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK01 · ACB' });
    const t0 = Math.floor(Date.now() / 1000);
    const r = await svc.ingest(pl({ content: 'Chuyển tiền NỘI BỘ TK01 sang TK03' }));
    expect(r.status).toBe('recorded');
    const b = await bt(r.bankTxId!);
    expect([b.type, b.status, b.confirm, b.cusId]).toEqual(['2', 'yes', 'no', null]);
    expect(b.mdate!).toBeGreaterThanOrEqual(t0);
    const d = await details(r.bankTxId!);
    expect(d).toHaveLength(1);
    expect([d[0].type, d[0].money, d[0].payInfo, d[0].note, d[0].author, d[0].cusId, d[0].confirm, d[0].poId, d[0].walletStream]).toEqual([
      '2', BigInt(2000000), 'CK ACB', NOTE_NBO_OUT, 'auto', null, 'no', 0, null,
    ]);
    expect(d[0].cdate!).toBeGreaterThanOrEqual(t0);
    expect(await prisma.bankChiMatch.count()).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
    expect(await prisma.glEntry.count()).toBe(0);
  });

  test('có mã TBS khách ĐANG HOẠT ĐỘNG ⇒ KHÔNG phải nội bộ (ghi chú "ẩn khỏi hàng chờ")', async () => {
    await seedKhach('TBS77');
    const r = await svc.ingest(pl({ content: 'noi bo TBS77' }));
    const d = await details(r.bankTxId!);
    expect(d.map((x) => [x.type, x.note])).toEqual([['2', NOTE_OUT_ALL]]);
  });

  test.each([
    ['khách ngừng hoạt động', 0],
    ['khách không tồn tại', null],
  ])('mã TBS của %s ⇒ vẫn là nội bộ', async (_n, act) => {
    if (act !== null) await seedKhach('TBS77', act);
    const r = await svc.ingest(pl({ content: 'noi bo TBS77' }));
    expect((await details(r.bankTxId!)).map((x) => x.note)).toEqual([NOTE_NBO_OUT]);
  });
});

describe('out — khớp phiếu chi (:139-169) + ẩn khỏi hàng chờ (:179-199)', () => {
  test('đúng 1 phiếu đúng tiền ⇒ BankChiMatch auto; detail type 2 "ẩn"; type=2/status=yes', async () => {
    const id = await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK01 · ACB' });
    const t0 = Math.floor(Date.now() / 1000);
    const r = await svc.ingest(pl());
    const m = await prisma.bankChiMatch.findMany();
    expect(m).toHaveLength(1);
    expect([m[0].bankTxId, m[0].requestId, m[0].method, m[0].matchedBy, m[0].unmatchedAt, m[0].unmatchedBy, m[0].note]).toEqual([
      BigInt(r.bankTxId!), id, 'auto', 'auto', null, null, 'Tu dong khop theo so tien',
    ]);
    expect(m[0].matchedAt).toBeGreaterThanOrEqual(t0);
    const d = await details(r.bankTxId!);
    expect(d.map((x) => [x.type, x.money, x.payInfo, x.note, x.author])).toEqual([['2', BigInt(2000000), 'CK ACB', NOTE_OUT_ALL, 'auto']]);
    const b = await bt(r.bankTxId!);
    expect([b.type, b.status, b.confirm]).toEqual(['2', 'yes', 'no']);
    expect(r.chiMatchRequestId).toBe(id);
  });

  test.each([
    ['chuỗi "2000000"', '2000000', true],
    ['"2000000.0"', '2000000.0', true],
    ['JSON thô "so_tien":2000000.0 (PHP json_decode ⇒ float; float === float, §12.11)', '{"so_tien":2000000.0}', true],
    ['"2.000.000" (PHP (float) = 2)', '2.000.000', false],
    ['"2,000,000"', '2,000,000', false],
    ['1999999', 1999999, false],
  ])('so_tien %s ⇒ khớp=%s', async (_n, soTien, khop) => {
    // chuỗi bắt đầu bằng '{' = form_data JSON THÔ (giữ nguyên chữ số lẻ .0); còn lại bọc thành { so_tien }
    if (typeof soTien === 'string' && soTien.startsWith('{')) await seedPhieuChi(soTien);
    else await seedPhieuChi({ so_tien: soTien });
    await svc.ingest(pl());
    expect(await prisma.bankChiMatch.count()).toBe(khop ? 1 : 0);
  });

  test('HAI phiếu đúng tiền, không phiếu nào mang mã TK ⇒ KHÔNG khớp (vẫn ẩn khỏi hàng chờ)', async () => {
    await seedPhieuChi({ so_tien: 2000000 });
    await seedPhieuChi({ so_tien: '2000000', tk_chi_tbs: 'Tài khoản ACB' });
    const r = await svc.ingest(pl());
    expect(await prisma.bankChiMatch.count()).toBe(0);
    expect((await details(r.bankTxId!)).map((x) => x.note)).toEqual([NOTE_OUT_ALL]);
    expect((await bt(r.bankTxId!)).status).toBe('yes');
    expect(r.chiMatchRequestId).toBeUndefined();
  });

  test('HAI phiếu đúng tiền, đúng 1 phiếu có ^TKnn == tk_code ⇒ khớp phiếu đó', async () => {
    await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK03 · Cá nhân' });
    const id = await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK01 · ACB' });
    await svc.ingest(pl());
    expect((await prisma.bankChiMatch.findMany()).map((m) => m.requestId)).toEqual([id]);
  });

  test('HAI phiếu đúng tiền đều TK01 ⇒ KHÔNG khớp', async () => {
    await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK01 · a' });
    await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK01 · b' });
    await svc.ingest(pl());
    expect(await prisma.bankChiMatch.count()).toBe(0);
  });

  test("'TK011 · x' KHÔNG phải TK01 (^(TK\\d+) tham lam) ⇒ 2 ứng viên, không ưu tiên ⇒ không khớp", async () => {
    await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK011 · x' });
    await seedPhieuChi({ so_tien: 2000000 });
    await svc.ingest(pl());
    expect(await prisma.bankChiMatch.count()).toBe(0);
  });

  test('1 phiếu đúng tiền nhưng TK khác ⇒ vẫn khớp (lùi về theo số tiền)', async () => {
    const id = await seedPhieuChi({ so_tien: 2000000, tk_chi_tbs: 'TK03 · Cá nhân' });
    await svc.ingest(pl());
    expect((await prisma.bankChiMatch.findMany()).map((m) => m.requestId)).toEqual([id]);
  });

  test('loại khỏi ứng viên: status≠2, đã xoá, mẫu khác, đang có chi_match hiệu lực; chi_match ĐÃ GỠ thì vẫn là ứng viên', async () => {
    const khac = (await seedTemplate('phieu_chi_khac')).id;
    await seedPhieuChi({ so_tien: 2000000 }, { status: 1 });
    await seedPhieuChi({ so_tien: 2000000 }, { isDeleted: true });
    await seedPhieuChi({ so_tien: 2000000 }, { templateId: khac });
    const daKhop = await seedPhieuChi({ so_tien: 2000000 });
    await seedBankChiMatch({ bankTxId: BigInt(999), requestId: daKhop, method: 'manual' });
    const daGo = await seedPhieuChi({ so_tien: 2000000 });
    await seedBankChiMatch({ bankTxId: BigInt(998), requestId: daGo, unmatchedAt: 5, unmatchedBy: 'zz' });
    const r = await svc.ingest(pl());
    const m = await prisma.bankChiMatch.findMany({ where: { bankTxId: BigInt(r.bankTxId!) } });
    expect(m.map((x) => x.requestId)).toEqual([daGo]);
  });

  test('form_data hỏng / vô hướng / NULL / thiếu so_tien ⇒ bỏ qua (không phải ứng viên)', async () => {
    await seedPhieuChi('{hỏng');
    await seedPhieuChi('2000000');
    await seedPhieuChi(null);
    await seedPhieuChi({ tk_chi_tbs: 'TK01' });
    const id = await seedPhieuChi({ so_tien: 2000000 });
    await svc.ingest(pl());
    expect((await prisma.bankChiMatch.findMany()).map((m) => m.requestId)).toEqual([id]);
  });

  test('chi_ghi_nhan ⇒ KHÔNG phân loại chiều out (không detail, không khớp, status no)', async () => {
    await seedPhieuChi({ so_tien: 2000000 });
    const r = await svc.ingest(pl({ content: 'noi bo' }), { mode: 'chi_ghi_nhan' });
    expect(await details(r.bankTxId!)).toHaveLength(0);
    expect(await prisma.bankChiMatch.count()).toBe(0);
    expect((await bt(r.bankTxId!)).status).toBe('no');
  });
});

// ═════════════════════════════ chiều in: nội bộ ═════════════════════════════
describe('in + "noi bo" (:200-239)', () => {
  test("⇒ vẫn ghi sổ quỹ; detail type 3 auto; type=3/status=yes/cus_id=''; KHÔNG gán khách dù có lịch sử", async () => {
    await seedKhach('TBS9');
    await seedLichSu('nap noi bo tu tk ca nhan', 'TBS9', 3);
    const r = await svc.ingest(pl({ transferType: 'in', content: 'Nạp nội bộ từ TK cá nhân' }));
    expect(r.status).toBe('posted');
    const b = await bt(r.bankTxId!);
    expect([b.type, b.status, b.confirm, b.cusId]).toEqual(['3', 'yes', 'no', '']);
    const d = await details(r.bankTxId!);
    expect(d.map((x) => [x.type, x.money, x.payInfo, x.note, x.author])).toEqual([['3', BigInt(2000000), 'CK ACB', NOTE_NB_IN, 'auto']]);
    expect(await prisma.treasuryEntry.count()).toBe(1);
    await khongGhiVi();
  });

  test('"noi bo" + mã TBS khách hoạt động ⇒ KHÔNG nội bộ; tầng 1 gán khách; 0 detail', async () => {
    await seedKhach('TBS77');
    const r = await svc.ingest(pl({ transferType: 'in', content: 'noi bo TBS77' }));
    const b = await bt(r.bankTxId!);
    expect([b.type, b.status, b.cusId]).toEqual(['1', 'no', 'TBS77']);
    expect(await details(r.bankTxId!)).toHaveLength(0);
  });
});

// ═════════════════════════════ gán khách 3 tầng ═════════════════════════════
const IN = { transferType: 'in' as const };

describe('tầng 1 — mã TBS trong nội dung (chỉ khách ĐANG HOẠT ĐỘNG)', () => {
  test('khách hoạt động ⇒ cus_id + mdate; 0 dòng ví', async () => {
    await seedKhach('TBS0077');
    const t0 = Math.floor(Date.now() / 1000);
    const r = await svc.ingest(pl({ ...IN, content: 'ck TBS-0077 tien hang' }));
    const b = await bt(r.bankTxId!);
    expect(b.cusId).toBe('TBS0077');
    expect(b.mdate!).toBeGreaterThanOrEqual(t0);
    expect([b.type, b.status, b.confirm]).toEqual(['1', 'no', 'no']); // KHÔNG duyệt/nạp
    expect(r.cusId).toBe('TBS0077');
    await khongGhiVi();
  });

  test.each([
    ['ngừng hoạt động', 0],
    ['không tồn tại', null],
  ])('khách %s ⇒ không gán', async (_n, act) => {
    if (act !== null) await seedKhach('TBS0077', act);
    const r = await svc.ingest(pl({ ...IN, content: 'ck TBS0077 tien hang' }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
    expect(r.cusId).toBeUndefined();
  });

  test('chi_ghi_nhan ⇒ không gán khách', async () => {
    await seedKhach('TBS0077');
    const r = await svc.ingest(pl({ ...IN, content: 'TBS0077' }), { mode: 'chi_ghi_nhan' });
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test('tiền 0 (không ghi sổ) vẫn gán khách như prod', async () => {
    await seedKhach('TBS5');
    const r = await svc.ingest(pl({ ...IN, content: 'TBS5', transferAmount: 0 }));
    expect(r.status).toBe('recorded');
    expect((await bt(r.bankTxId!)).cusId).toBe('TBS5');
  });
});

describe('tầng 2 — "vân tay" nội dung (≥8 ký tự, ≥3 từ, không chung chung, ≥2 lần, 100% một khách)', () => {
  // 'anh' < 5 ký tự ⇒ tầng 3 KHÔNG bắt được — cô lập tầng 2.
  const SIG = 'ANH BA chuyen tien hang lo ao 12345';

  test('2 lần cùng một khách ⇒ gán; đuôi -GD và số bị bỏ khi so', async () => {
    await seedKhach('KH01');
    await seedLichSu('Anh Ba chuyen tien hang lo ao 999', 'KH01', 2);
    const r = await svc.ingest(pl({ ...IN, content: SIG + '-GD 77XYZ abc' }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH01');
    await khongGhiVi();
  });

  test('chỉ 1 lần ⇒ không gán', async () => {
    await seedKhach('KH01');
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH01', 1);
    const r = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test('lịch sử lẫn 2 khách ⇒ không gán', async () => {
    await seedKhach('KH01');
    await seedKhach('KH02');
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH01', 2);
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH02', 1);
    const r = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test("dòng lịch sử cus_id NULL / '' không tính", async () => {
    await seedKhach('KH01');
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH01', 2);
    await seedLichSu('anh ba chuyen tien hang lo ao', '', 2);
    await seedLichSu('anh ba chuyen tien hang lo ao', null, 2);
    const r = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH01');
  });

  test('khách trong lịch sử ngừng hoạt động ⇒ không gán', async () => {
    await seedKhach('KH01', 0);
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH01', 2);
    const r = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test.each([
    ['cụm chung chung "giao dich chuyen tien"', 'Giao dich chuyen tien', 'giao dich chuyen tien'],
    ['cụm chung chung "thanh toan tien hang"', 'thanh toan tien hang 123', 'thanh toan tien hang'],
    ['< 8 ký tự', 'an ba c', 'an ba c'],
    ['< 3 từ', 'anh batu', 'anh batu'],
  ])('%s ⇒ không gán (dù có 2 lần lịch sử)', async (_n, content, lichSu) => {
    await seedKhach('KH01');
    await seedLichSu(lichSu, 'KH01', 2);
    const r = await svc.ingest(pl({ ...IN, content }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test('cụm chung chung CÓ DẤU không nằm trong danh sách (so === chuỗi không dấu) ⇒ vẫn gán như prod', async () => {
    await seedKhach('KH01');
    await seedLichSu('giao dịch chuyển tiền', 'KH01', 2);
    const r = await svc.ingest(pl({ ...IN, content: 'Giao dịch chuyển tiền' }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH01');
  });

  test('chỉ xét 3.000 dòng ĐÃ GÁN gần nhất', async () => {
    await seedKhach('KH01');
    await seedLichSu('anh ba chuyen tien hang lo ao', 'KH01', 2);
    await prisma.bankTransaction.createMany({
      data: Array.from({ length: 3000 }, () => ({ bankid: '', tranType: '+', tranAmount: BigInt(1), tranMess: 'zz khac', cusId: 'KH09' })),
    });
    const r = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
    // gỡ gán 2 dòng cũ nhất trong cửa sổ ⇒ 2 dòng lịch sử cũ lọt vào 3.000 dòng gần nhất ⇒ gán
    await prisma.bankTransaction.updateMany({ where: { tranMess: 'zz khac', id: { lte: BigInt(4) } }, data: { cusId: '' } });
    const r2 = await svc.ingest(pl({ ...IN, content: SIG }));
    expect((await bt(r2.bankTxId!)).cusId).toBe('KH01');
  });
});

describe('tầng 3 — tên người gửi (từ đầu ≥5 ký tự sau khi bỏ stop-word; ≥2 lần; 100% một khách)', () => {
  test('pháp nhân + stop-word bị bỏ ⇒ "hoang" khớp lịch sử khác nội dung ⇒ gán', async () => {
    await seedKhach('KH07');
    await seedLichSu('HOANG MINH chuyen tien', 'KH07', 1);
    await seedLichSu('Cty Hoàng? không — HOANG thanh toan dot 2', 'KH07', 1); // 'cty' bỏ, 'hoàng' ≠ 'hoang'
    await seedLichSu('tt HOANG LAN', 'KH07', 1);
    const r = await svc.ingest(pl({ ...IN, content: 'CONG TY TNHH HOANG LONG thanh toan don 55' }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH07');
    await khongGhiVi();
  });

  test('tầng 3 chạy cả khi tầng 2 bị loại vì < 3 từ', async () => {
    await seedKhach('KH05');
    await seedLichSu('hoangvu tt 123', 'KH05', 2);
    const r = await svc.ingest(pl({ ...IN, content: 'hoangvu ck' }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH05');
  });

  test('lịch sử tầng 3 KHÔNG cắt 60 ký tự (:275-279 không có mb_substr) — tên nằm vắt qua ký tự thứ 60 vẫn khớp', async () => {
    await seedKhach('KH06');
    const dai = 'tt '.repeat(19) + 'HOANGMINH lo 2'; // 57 ký tự stop-word rồi tên: cắt 60 ⇒ 'hoa'
    expect(C.tenNguoiGui(C.chuKy(dai))).toBe('');
    expect(C.tenNguoiGui(C.chuKy(dai, false))).toBe('hoangminh');
    await seedLichSu(dai, 'KH06', 2);
    const r = await svc.ingest(pl({ ...IN, content: 'HoangMinh ck' }));
    expect((await bt(r.bankTxId!)).cusId).toBe('KH06');
  });

  test('từ đầu < 5 ký tự ⇒ không gán', async () => {
    await seedKhach('KH08');
    await seedLichSu('an khang mua hang', 'KH08', 3);
    const r = await svc.ingest(pl({ ...IN, content: 'CTY AN PHAT ck' }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });

  test('tên có dấu so theo KÝ TỰ: "trần" (4 ký tự) ⇒ không; "nguyễn" ⇒ có', async () => {
    await seedKhach('KH10');
    await seedKhach('KH11');
    await seedLichSu('trần văn a', 'KH10', 2);
    await seedLichSu('nguyễn thị b', 'KH11', 2);
    const r1 = await svc.ingest(pl({ ...IN, content: 'TRẦN VĂN C' }));
    const r2 = await svc.ingest(pl({ ...IN, content: 'NGUYỄN VĂN D' }));
    expect((await bt(r1.bankTxId!)).cusId).toBeNull();
    expect((await bt(r2.bankTxId!)).cusId).toBe('KH11');
  });

  test('lịch sử tên lẫn 2 khách ⇒ không gán', async () => {
    await seedKhach('KH07');
    await seedKhach('KH08');
    await seedLichSu('hoang minh', 'KH07', 2);
    await seedLichSu('hoang lan', 'KH08', 1);
    const r = await svc.ingest(pl({ ...IN, content: 'HOANG LONG ck' }));
    expect((await bt(r.bankTxId!)).cusId).toBeNull();
  });
});

// ═════════════════════════════ sửa mang từ review Task 1 ═════════════════════════════
describe('replayFrom — mốc ≤ 0 bị từ chối; giao dịch đã có BẤT KỲ dòng sổ bank_tx (kể cả đã đảo) ⇒ bỏ qua', () => {
  test.each([[0], [-1], [0n]])('replayFrom(%p) ⇒ ném BankIngestError, 0 dòng sổ', async (mark) => {
    await svc.ingest(pl({ ...IN }), { mode: 'chi_ghi_nhan' });
    await expect(svc.replayFrom(mark as any, DEN)).rejects.toThrow(BankIngestError);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('dòng sổ bank_tx đã bị ĐẢO (hasPosted coi là chưa ghi) ⇒ replay vẫn KHÔNG ghi lại', async () => {
    await seedBankTransaction({ bankid: '', tranMess: 'moc' }); // id 1 = mốc
    const r = await svc.ingest(pl({ ...IN }), { mode: 'chi_ghi_nhan' });
    const h = await prisma.treasuryEntry.create({
      data: { tkCode: 'TK01', type: 'in', money: '2000000', status: 1, sourceModule: 'bank_tx', sourceId: r.bankTxId! },
    });
    await prisma.treasuryEntry.create({
      data: { tkCode: 'TK01', type: 'out', money: '2000000', status: 1, sourceModule: 'dao', sourceId: 0, reversalOf: h.id },
    });
    expect(await prisma.$transaction((tx) => treasury.hasPosted(tx as any, 'bank_tx', r.bankTxId!))).toBe(0); // đối chứng
    expect((await svc.replayFrom(1, DEN)).posted).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(2);
    expect(await prisma.glEntry.count()).toBe(0);
  });
});

// ═════════════════════════════ Fix round 1: replay = ingest bình thường ═════════════════════════════
describe('Fix round 1 — replayFrom tái tạo ĐÚNG trạng thái của ingest bình thường (chung routine sauInsert)', () => {
  const PAYLOADS: SepayPayload[] = [
    { id: 'ZZF1', gateway: 'ACB', transactionDate: '2026-09-25 09:00:00', accountNumber: STK1, transferType: 'out', transferAmount: 1000000, content: 'Chuyển tiền NỘI BỘ TK01 sang TK03' },
    { id: 'ZZF2', gateway: 'ACB', transactionDate: '2026-09-25 09:01:00', accountNumber: STK1, transferType: 'out', transferAmount: 3000000, content: 'thanh toan NCC hang lo 5' },
    { id: 'ZZF3', gateway: 'MBBank', transactionDate: '2026-09-25 09:02:00', accountNumber: STK3, transferType: 'in', transferAmount: 500000, content: 'Nạp nội bộ từ TK cá nhân' },
    { id: 'ZZF4', gateway: 'ACB', transactionDate: '2026-09-25 09:03:00', accountNumber: STK1, transferType: 'in', transferAmount: 700000, content: 'TBS77 chuyen tien hang' },
    { id: 'ZZF5', gateway: 'ACB', transactionDate: '2026-09-25 09:04:00', accountNumber: STK1, transferType: 'in', transferAmount: 800000, content: 'nap tien vi' },
  ];

  /** Dữ liệu nền GIỐNG NHAU cho cả hai kịch bản. Lịch sử "nap noi bo…" → TBS77 ×2: nếu replay lần 2 quên
   *  chốt "đã có detail", dòng nạp nội bộ (cus_id='') sẽ bị gán TBS77 ⇒ lộ ra. */
  async function nen() {
    await seedKhach('TBS77');
    await seedBankTransaction({ bankid: '', tranMess: 'moc' }); // id 1 = mốc replay
    await seedLichSu('Nạp nội bộ từ TK cá nhân', 'TBS77', 2);
    await seedPhieuChi({ so_tien: 3000000, tk_chi_tbs: 'TK01 · ACB' });
  }

  /** Trạng thái đầy đủ, bỏ giờ (chỉ giữ "có/không") — so từng trường. */
  async function trangThai() {
    const bts = await prisma.bankTransaction.findMany({ orderBy: { id: 'asc' } });
    const dts = await prisma.bankTransactionDetail.findMany({ orderBy: { id: 'asc' } });
    const ms = await prisma.bankChiMatch.findMany({ orderBy: { id: 'asc' } });
    const hs = await prisma.treasuryEntry.findMany({ orderBy: { id: 'asc' } });
    const es = await prisma.glEntry.findMany({ orderBy: { id: 'asc' } });
    const ls = await prisma.glLine.findMany({ orderBy: [{ entryId: 'asc' }, { lineNo: 'asc' }] });
    return {
      bt: bts.map((b) => ({
        id: b.id, bankid: b.bankid, bankName: b.bankName, tranType: b.tranType, tranAmount: b.tranAmount, tranTime: b.tranTime,
        tranMess: b.tranMess, originMess: b.originMess, cusId: b.cusId, type: b.type, status: b.status, confirm: b.confirm,
        tkCode: b.tkCode, coMdate: b.mdate !== null,
      })),
      detail: dts.map((d) => ({
        tranId: d.tranId, type: d.type, money: d.money, cusId: d.cusId, payInfo: d.payInfo, note: d.note, author: d.author,
        coCdate: d.cdate !== null, mdate: d.mdate, confirm: d.confirm, poId: d.poId, walletStream: d.walletStream,
      })),
      chiMatch: ms.map((m) => ({
        bankTxId: m.bankTxId, requestId: m.requestId, method: m.method, matchedBy: m.matchedBy, coMatchedAt: m.matchedAt > 0,
        unmatchedAt: m.unmatchedAt, unmatchedBy: m.unmatchedBy, note: m.note,
      })),
      so: hs.map((h) => ({
        id: h.id, tkCode: h.tkCode, type: h.type, money: h.money?.toFixed(5), status: h.status, cuser: h.cuser,
        approveUser: h.approveUser, note: h.note, sourceModule: h.sourceModule, sourceId: h.sourceId, reversalOf: h.reversalOf,
      })),
      gl: es.map((e) => ({ id: e.id, sourceType: e.sourceType, sourceId: e.sourceId, createdBy: e.createdBy, description: e.description })),
      glLine: ls.map((l) => [l.entryId, l.lineNo, l.accountCode, l.debit.toFixed(2), l.credit.toFixed(2)]),
    };
  }

  test('5 dòng (out nội bộ, out khớp phiếu chi, in nội bộ, in mã TBS, + thường): chi_ghi_nhan + replay ≡ ingest thường; replay lần 2 = 0', async () => {
    // Kịch bản A — ingest bình thường
    await nen();
    for (const p of PAYLOADS) await svc.ingest(p);
    const A = await trangThai();
    // mốc chứng thực kịch bản A đúng là "đã xử lý đủ"
    expect(A.detail.map((d) => [d.type, d.author])).toEqual([['2', 'auto'], ['2', 'auto'], ['3', 'auto']]);
    expect(A.chiMatch).toHaveLength(1);
    expect(A.so).toHaveLength(3);
    expect(A.gl).toHaveLength(3);
    expect(A.bt.find((b) => b.bankid === 'ZZF4')!.cusId).toBe('TBS77');
    expect(A.bt.find((b) => b.bankid === 'ZZF3')!.cusId).toBe('');

    // Kịch bản B — đóng băng rồi ghi bù
    await datLai();
    await nen();
    for (const p of PAYLOADS) expect((await svc.ingest(p, { mode: 'chi_ghi_nhan' })).status).toBe('recorded');
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
    expect(await prisma.treasuryEntry.count()).toBe(0);
    const r1 = await svc.replayFrom(1, DEN);
    expect(r1).toEqual({ posted: 3, classified: 3, assigned: 1, failed: [] });
    const B = await trangThai();
    expect(B).toEqual(A);

    // chạy lại ⇒ no-op tuyệt đối
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 0, classified: 0, assigned: 0, failed: [] });
    expect(await trangThai()).toEqual(A);
    await khongGhiVi();
  });

  test('một dòng lỗi ⇒ tx dòng đó lùi, id vào failed; các dòng khác vẫn ghi; log chỉ có id; lượt sau ghi nốt', async () => {
    await seedBankTransaction({ bankid: '', tranMess: 'moc' });
    const ids: number[] = [];
    for (const id of ['ZZE1', 'ZZE2', 'ZZE3']) {
      ids.push((await svc.ingest(pl({ id, transferType: 'in', content: 'ZZNOIDUNG ' + id }), { mode: 'chi_ghi_nhan' })).bankTxId!);
    }
    const goc = treasury.postEntry.bind(treasury);
    const spy = jest.spyOn(treasury, 'postEntry').mockImplementation((async (tx: any, tk: any, type: any, money: any, o: any) => {
      if (o.sourceId === ids[1]) throw new Error('zz hỏng giả');
      return goc(tx, tk, type, money, o);
    }) as any);
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const r = await svc.replayFrom(1, DEN);
    spy.mockRestore();
    expect(r).toEqual({ posted: 2, classified: 0, assigned: 0, failed: [ids[1]] });
    expect((await prisma.treasuryEntry.findMany({ orderBy: { id: 'asc' } })).map((h) => h.sourceId)).toEqual([ids[0], ids[2]]);
    expect(await prisma.glEntry.count()).toBe(2);
    const msgs = logSpy.mock.calls.map((c) => String(c[0]));
    logSpy.mockRestore();
    expect(msgs).toEqual([`[REPLAY-BANKTX] ghi bù thất bại bankTxId=${ids[1]} loi=Error`]);
    expect(msgs.join(' ').includes('ZZNOIDUNG') || msgs.join(' ').includes(STK1)).toBe(false);

    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 1, classified: 0, assigned: 0, failed: [] });
    expect(await prisma.treasuryEntry.count()).toBe(3);
  });

  test('chi_match tay trong cửa sổ đóng băng ⇒ replay KHÔNG khớp thêm (vẫn ẩn khỏi hàng chờ)', async () => {
    await seedBankTransaction({ bankid: '', tranMess: 'moc' });
    await seedPhieuChi({ so_tien: 2000000 });
    const tay = await seedPhieuChi({ so_tien: 9 });
    const r0 = await svc.ingest(pl(), { mode: 'chi_ghi_nhan' });
    await seedBankChiMatch({ bankTxId: BigInt(r0.bankTxId!), requestId: tay, method: 'manual' });
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 0, classified: 1, assigned: 0, failed: [] });
    expect((await prisma.bankChiMatch.findMany()).map((m) => [m.requestId, m.method])).toEqual([[tay, 'manual']]);
    expect((await bt(r0.bankTxId!)).status).toBe('yes');
  });

  test('ingest muộn cùng id của dòng ĐÃ ghi nhận (chạy cùng lúc replay) ⇒ duplicate; replay xử lý đúng một lần', async () => {
    await seedBankTransaction({ bankid: '', tranMess: 'moc' });
    await seedKhach('TBS77');
    const p = pl({ id: 'ZZL1', transferType: 'in', content: 'TBS77 ck' });
    await svc.ingest(p, { mode: 'chi_ghi_nhan' });
    const [r, i] = await Promise.all([svc.replayFrom(1, DEN), svc.ingest(p)]);
    expect(i.status).toBe('duplicate');
    expect(r).toEqual({ posted: 1, classified: 0, assigned: 1, failed: [] });
    expect(await prisma.treasuryEntry.count()).toBe(1);
    expect((await prisma.bankTransaction.findFirstOrThrow({ where: { bankid: 'ZZL1' } })).cusId).toBe('TBS77');
  });
});

// ═════════════════════════════ Final-review fix round (M1, M2, M3, M5, M7, T1) ═════════════════════════════
describe('Final-review fix round', () => {
  const MOC_TEXT = 'moc';
  async function moc() {
    await seedBankTransaction({ bankid: '', tranMess: MOC_TEXT }); // id 1 = mốc replay
  }

  test('M1 ingest in: phân loại NÉM lỗi CSDL giữa tx ⇒ SAVEPOINT lùi riêng phần phân loại; giao dịch + dòng sổ + GL còn; không ném; log chỉ id + tên lỗi; gửi lại ⇒ duplicate', async () => {
    const spy = jest.spyOn(svc as any, 'phanLoaiIn').mockImplementation((async (tx: any) => {
      await tx.bankTransaction.updateMany({ data: { cusId: 'ZZBAN' } }); // ghi dở — phải bị lùi
      await tx.$executeRawUnsafe('SELECT 1/0'); // lỗi CSDL ⇒ tx Postgres ở trạng thái aborted
    }) as any);
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const p = pl({ id: 'ZZM1', transferType: 'in', content: 'ZZNOIDUNG TBS77 ck' });
    const r = await svc.ingest(p);
    spy.mockRestore();
    expect([r.status, r.classify, r.gl]).toEqual(['posted', 'error', 'posted']);
    const b = await bt(r.bankTxId!);
    expect([b.bankid, b.cusId, b.type, b.status]).toEqual(['ZZM1', null, '1', 'no']);
    expect(await prisma.treasuryEntry.count({ where: { sourceModule: 'bank_tx', sourceId: r.bankTxId! } })).toBe(1);
    expect(await prisma.glEntry.count()).toBe(1);
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
    const msgs = logSpy.mock.calls.map((c) => String(c[0]));
    logSpy.mockRestore();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(new RegExp(`^\\[BANK-CLS\\] phân loại thất bại bankTxId=${r.bankTxId} sepayId=ZZM1 tk=TK01 loi=PrismaClientKnownRequestError`));
    expect(msgs[0].includes('ZZNOIDUNG') || msgs[0].includes(STK1)).toBe(false);
    expect((await svc.ingest(p)).status).toBe('duplicate');
  });

  test('M1 ingest out: phân loại NÉM (JS) ⇒ giao dịch còn (status no, 0 detail, 0 khớp); replay sau đó phân loại bù', async () => {
    await moc();
    await seedPhieuChi({ so_tien: 2000000 });
    const spy = jest.spyOn(svc as any, 'phanLoaiOut').mockRejectedValueOnce(new TypeError('zz'));
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const r = await svc.ingest(pl({ id: 'ZZM1B' }));
    spy.mockRestore();
    expect([r.status, r.classify]).toEqual(['recorded', 'error']);
    expect(String(logSpy.mock.calls[0][0])).toContain('loi=TypeError');
    logSpy.mockRestore();
    expect((await bt(r.bankTxId!)).status).toBe('no');
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
    expect(await prisma.bankChiMatch.count()).toBe(0);
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 0, classified: 1, assigned: 0, failed: [] });
    expect(await prisma.bankChiMatch.count()).toBe(1);
  });

  test('M1 replay: phân loại NÉM ⇒ dòng sổ VẪN ghi (đếm posted), id vào failed; lượt sau gán khách', async () => {
    await moc();
    await seedKhach('TBS77');
    const a = await svc.ingest(pl({ id: 'ZZM1C', transferType: 'in', content: 'TBS77 ck' }), { mode: 'chi_ghi_nhan' });
    const spy = jest.spyOn(svc as any, 'phanLoaiIn').mockRejectedValueOnce(new Error('zz'));
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const r = await svc.replayFrom(1, DEN);
    spy.mockRestore();
    logSpy.mockRestore();
    expect(r).toEqual({ posted: 1, classified: 0, assigned: 0, failed: [a.bankTxId] });
    expect(await prisma.treasuryEntry.count()).toBe(1);
    expect(await prisma.glEntry.count()).toBe(1);
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 0, classified: 0, assigned: 1, failed: [] });
    expect((await bt(a.bankTxId!)).cusId).toBe('TBS77');
  });

  test('M5 replay đọc originMess (cái ingest thường đã dùng), KHÔNG đọc tranMess đã bị sửa', async () => {
    await moc();
    await seedKhach('TBS77');
    const a = await svc.ingest(pl({ id: 'ZZM5', transferType: 'in', content: 'TBS77 ck' }), { mode: 'chi_ghi_nhan' });
    await prisma.bankTransaction.update({ where: { id: BigInt(a.bankTxId!) }, data: { tranMess: 'noi bo sua tay' } });
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 1, classified: 0, assigned: 1, failed: [] });
    const b = await bt(a.bankTxId!);
    expect([b.cusId, b.type, b.status, b.tranMess]).toEqual(['TBS77', '1', 'no', 'noi bo sua tay']);
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
    const h = await prisma.treasuryEntry.findFirstOrThrow();
    expect(h.note).toBe('Bank báo có tự động — TBS77 ck');
  });

  test.each([
    ['thiếu trần', [1]],
    ['trần = mốc', [5, 5]],
    ['trần < mốc', [5, 4]],
    ['trần không nguyên', [1, 2.5]],
    ['trần kiểu chuỗi', [1, '9']],
  ])('M2 replayFrom %s ⇒ ném BankIngestError, 0 dòng sổ', async (_n, args) => {
    await moc();
    await svc.ingest(pl({ id: 'ZZM2X', transferType: 'in' }), { mode: 'chi_ghi_nhan' });
    await expect((svc.replayFrom as any)(...args)).rejects.toThrow(BankIngestError);
    expect(await prisma.treasuryEntry.count()).toBe(0);
  });

  test('M2 chỉ xử lý mốc < id ≤ trần; dòng sau trần không bị đụng', async () => {
    await moc();
    const ids: number[] = [];
    for (const id of ['ZZM2A', 'ZZM2B', 'ZZM2C']) {
      ids.push((await svc.ingest(pl({ id, transferType: 'in' }), { mode: 'chi_ghi_nhan' })).bankTxId!);
    }
    const out = (await svc.ingest(pl({ id: 'ZZM2D' }), { mode: 'chi_ghi_nhan' })).bankTxId!; // out sau trần
    expect(await svc.replayFrom(1, ids[1])).toEqual({ posted: 2, classified: 0, assigned: 0, failed: [] });
    expect((await prisma.treasuryEntry.findMany({ orderBy: { id: 'asc' } })).map((h) => h.sourceId)).toEqual([ids[0], ids[1]]);
    expect((await bt(out)).status).toBe('no');
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
    expect(await svc.replayFrom(ids[1], out)).toEqual({ posted: 1, classified: 1, assigned: 0, failed: [] });
  });

  test('M3 dòng "nạp nội bộ" mà kế toán đã đặt cus_id trong cửa sổ đóng băng ⇒ replay GIỮ cus_id', async () => {
    await moc();
    const a = await svc.ingest(pl({ id: 'ZZM3', transferType: 'in', content: 'Nạp nội bộ từ TK cá nhân' }), { mode: 'chi_ghi_nhan' });
    await prisma.bankTransaction.update({ where: { id: BigInt(a.bankTxId!) }, data: { cusId: 'TBS77' } });
    expect(await svc.replayFrom(1, DEN)).toEqual({ posted: 1, classified: 1, assigned: 0, failed: [] });
    const b = await bt(a.bankTxId!);
    expect([b.type, b.status, b.cusId]).toEqual(['3', 'yes', 'TBS77']);
    expect((await details(a.bankTxId!)).map((d) => d.type)).toEqual(['3']);
  });

  test('T1 ĐUA THẬT: ingest thường (dòng CHƯA tồn tại) chạy cùng lúc replay ⇒ đúng một lần xử lý, replay không đụng', async () => {
    await moc();
    await seedKhach('TBS77');
    for (let k = 0; k < 5; k++) {
      const p = pl({ id: 'ZZT1' + k, transferType: 'in', content: 'TBS77 ck' });
      const [i, r] = await Promise.all([svc.ingest(p), svc.replayFrom(1, DEN)]);
      expect(i.status).toBe('posted');
      expect(r).toEqual({ posted: 0, classified: 0, assigned: 0, failed: [] });
      expect(await prisma.treasuryEntry.count({ where: { sourceId: i.bankTxId! } })).toBe(1);
      expect((await bt(i.bankTxId!)).cusId).toBe('TBS77');
    }
    expect(await prisma.treasuryEntry.count()).toBe(5);
    expect(await prisma.bankTransactionDetail.count()).toBe(0);
  });
});
