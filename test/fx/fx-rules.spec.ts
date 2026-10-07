// 09c L2, Task 1 — hàm thuần FX (`src/money/fx-rules.ts`). KHÔNG CSDL.
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §5.1–5.4, §10.2, §12, §14.
// Brief: .superpowers/sdd/2026-09-25-09c-L2-fx-core-plan/task-1-brief.md
// Fix round 1: coordinator đọc thẳng prod HEAD (`libs/cls.treasury.php:194-247`,
// `libs/cls.approval.php:2540+`, 1 SELECT) và cung cấp công thức/thông điệp CHÍNH XÁC cho
// 3 mục từng là NEEDS_CONTEXT ở lượt đầu — test file viết lại theo API mới.
import { Prisma } from '@prisma/client';
import {
  amountInTuRate,
  bienTyGiaVnd,
  fxKiemAgent,
  kiemTyGiaFx,
  rateSuyNguoc,
  tinhPhiFxPercent,
  viPhiFx,
} from '../../src/money/fx-rules';

const D = (v: string | number) => new Prisma.Decimal(v);

// ───────────────────────── bienTyGiaVnd (fix round 1) ─────────────────────────
describe('bienTyGiaVnd — biên cứng ngoại tệ so VND (coordinator, prod cls.treasury.php:194-247)', () => {
  test('USD → [20.000; 35.000]', () => {
    expect(bienTyGiaVnd('USD')).toEqual([D(20000), D(35000)]);
  });
  test('CNY → [2.500; 6.000]', () => {
    expect(bienTyGiaVnd('CNY')).toEqual([D(2500), D(6000)]);
  });
  test('EUR → [20.000; 45.000]', () => {
    expect(bienTyGiaVnd('EUR')).toEqual([D(20000), D(45000)]);
  });
  test('JPY → [100; 400]', () => {
    expect(bienTyGiaVnd('JPY')).toEqual([D(100), D(400)]);
  });
  test('KRW → [10; 50]', () => {
    expect(bienTyGiaVnd('KRW')).toEqual([D(10), D(50)]);
  });
  test('tệ không có trong bảng (vd. GBP) ⇒ null, KHÔNG ném lỗi', () => {
    expect(bienTyGiaVnd('GBP')).toBeNull();
    expect(bienTyGiaVnd('VND')).toBeNull();
  });
  test('cur = strtoupper(trim(cur))', () => {
    expect(bienTyGiaVnd(' usd ')).toEqual([D(20000), D(35000)]);
  });
});

// ───────────────────────── kiemTyGiaFx (fix round 1: {ok,msg} + thông điệp đúng prod) ─────────────────────────
describe('kiemTyGiaFx(from,to,rate) — cls.treasury.php:194-247, {ok,msg} đúng thứ tự/thông điệp prod', () => {
  test('rate <= 0 ⇒ ok:false, thông điệp đúng', () => {
    expect(kiemTyGiaFx('USD', 'VND', D(0))).toEqual({ ok: false, msg: 'Tỷ giá phải lớn hơn 0.' });
    expect(kiemTyGiaFx('USD', 'VND', D(-5))).toEqual({ ok: false, msg: 'Tỷ giá phải lớn hơn 0.' });
  });

  test('cùng tệ: |rate-1| <= 0,0001 ⇒ ok:true (biên đúng)', () => {
    expect(kiemTyGiaFx('VND', 'VND', D('1.0001'))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('VND', 'VND', D('0.9999'))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'USD', D(1))).toEqual({ ok: true, msg: '' });
  });
  test('cùng tệ: |rate-1| > 0,0001 ⇒ ok:false, thông điệp có tên tệ', () => {
    expect(kiemTyGiaFx('VND', 'VND', D('1.0002'))).toEqual({
      ok: false,
      msg: 'Hai ví cùng loại tiền (VND) thì tỷ giá phải là 1.',
    });
    expect(kiemTyGiaFx('usd', 'USD', D('0.9998'))).toEqual({
      ok: false,
      msg: 'Hai ví cùng loại tiền (USD) thì tỷ giá phải là 1.',
    });
  });

  test('có VND (USD): trong biên [20.000;35.000] (kể cả đúng biên) ⇒ ok:true', () => {
    expect(kiemTyGiaFx('USD', 'VND', D(25000))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('VND', 'USD', D(25000))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'VND', D(20000))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'VND', D(35000))).toEqual({ ok: true, msg: '' });
  });

  test('có VND (CNY): dưới biên dưới, rate=1, KHÔNG trùng bien của tệ khác ⇒ ok:false, không có goiy', () => {
    const r = kiemTyGiaFx('CNY', 'VND', D(1));
    expect(r.ok).toBe(false);
    expect(r.msg).toBe(
      'Tỷ giá 1,00 không hợp lý cho ví CNY: VND/CNY phải nằm trong khoảng 2.500 – 6.000.',
    );
  });

  test('có VND (USD ngoài biên trên): rate=40.000 — nằm trong biên EUR [20.000;45.000] ⇒ goiy gợi ý EUR', () => {
    const r = kiemTyGiaFx('USD', 'VND', D(40000));
    expect(r.ok).toBe(false);
    expect(r.msg).toBe(
      'Tỷ giá 40.000,00 không hợp lý cho ví USD: VND/USD phải nằm trong khoảng 20.000 – 35.000.' +
        ' Tỷ giá này trông giống tỷ giá EUR — có phải bạn định chọn ví EUR không?',
    );
  });

  test('có VND (USD ngoài biên dưới): rate=100 — trùng biên JPY [100;400] (CNY/EUR không trùng) ⇒ goiy JPY (đúng thứ tự USD,CNY,EUR,JPY,KRW)', () => {
    const r = kiemTyGiaFx('USD', 'VND', D(100));
    expect(r.ok).toBe(false);
    expect(r.msg).toBe(
      'Tỷ giá 100,00 không hợp lý cho ví USD: VND/USD phải nằm trong khoảng 20.000 – 35.000.' +
        ' Tỷ giá này trông giống tỷ giá JPY — có phải bạn định chọn ví JPY không?',
    );
  });

  test('có VND, tệ KHÔNG có trong bảng (vd. GBP) ⇒ SKIP, ok:true', () => {
    expect(kiemTyGiaFx('GBP', 'VND', D(999999))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('VND', 'GBP', D(0.0001))).toEqual({ ok: true, msg: '' });
  });

  test('ngoại↔ngoại USD→CNY: lo=20000/6000, hi=35000/2500=14 — đúng biên ⇒ true, ngoài biên ⇒ false có thông điệp đúng', () => {
    expect(kiemTyGiaFx('USD', 'CNY', D(20000).div(6000))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'CNY', D(14))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'CNY', D(7))).toEqual({ ok: true, msg: '' });

    const r = kiemTyGiaFx('USD', 'CNY', D(67));
    expect(r.ok).toBe(false);
    expect(r.msg).toBe('Tỷ giá 67,0000 không hợp lý cho cặp USD → CNY: 1 USD phải bằng khoảng 3,33 – 14,00 CNY.');
  });

  test('ngoại↔ngoại, một bên KHÔNG có trong bảng (vd. XYZ) ⇒ SKIP, ok:true dù rate bất kỳ', () => {
    expect(kiemTyGiaFx('XYZ', 'USD', D(999999))).toEqual({ ok: true, msg: '' });
    expect(kiemTyGiaFx('USD', 'XYZ', D(0.0001))).toEqual({ ok: true, msg: '' });
  });

  test('#053 ĐO ĐƯỢC (không còn giả định): phiếu FX-2609-053 là TK08→TK02, USD→CNY, rate=67,000000, status rejected — trượt kiemTyGiaFx đúng như §14 ghi nhận ("1 trượt")', () => {
    expect(kiemTyGiaFx('USD', 'CNY', D(67)).ok).toBe(false);
  });
});

// ───────────────────────── tinhPhiFxPercent (§5.3 điểm 4) ─────────────────────────
describe('tinhPhiFxPercent(base,pct,cur) = round(base*pct/100, cur==VND?0:2)', () => {
  test('VND ⇒ làm tròn 0 lẻ', () => {
    expect(tinhPhiFxPercent(D(1000000), D(1), 'VND').toString()).toBe('10000');
  });
  test('không phải VND ⇒ làm tròn 2 lẻ', () => {
    expect(tinhPhiFxPercent(D(1000), D(0.5), 'USD').toString()).toBe('5');
    expect(tinhPhiFxPercent(D(333.333), D(1), 'USD').toString()).toBe('3.33');
  });
  test('biên làm tròn nửa xa 0 — dương: VND 0,5 ⇒ 1 (không phải 0)', () => {
    expect(tinhPhiFxPercent(D(50), D(1), 'VND').toString()).toBe('1');
  });
  test('biên làm tròn nửa xa 0 — VND: -0,5 ⇒ -1 (xa 0, không phải -0/0)', () => {
    expect(tinhPhiFxPercent(D(-50), D(1), 'VND').toString()).toBe('-1');
  });
  test('biên làm tròn nửa xa 0 — 2 lẻ: 1,005 ⇒ 1,01 (không phải 1,00 kiểu JS float)', () => {
    expect(tinhPhiFxPercent(D('100.5'), D(1), 'USD').toString()).toBe('1.01');
  });
  test('biên làm tròn nửa xa 0 — 2 lẻ âm: -1,005 ⇒ -1,01', () => {
    expect(tinhPhiFxPercent(D('-100.5'), D(1), 'USD').toString()).toBe('-1.01');
  });
});

// ───────────────────────── amountInTuRate (§5.3 điểm 3) ─────────────────────────
describe('amountInTuRate — công thức amount_in (process_fx_transfer.php:81-92)', () => {
  test('cùng tệ ⇒ = amount_out', () => {
    expect(amountInTuRate('USD', 'USD', D(123.456), D(1)).toString()).toBe('123.456');
  });
  test('đích VND ⇒ round(out×rate,2)', () => {
    expect(amountInTuRate('USD', 'VND', D(100), D(25000)).toString()).toBe('2500000');
    expect(amountInTuRate('USD', 'VND', D(100), D('25000.005')).toString()).toBe('2500000.5');
  });
  test('nguồn VND ⇒ round(out÷rate,2)', () => {
    expect(amountInTuRate('VND', 'USD', D(2500000), D(25000)).toString()).toBe('100');
  });
  test('ngoại↔ngoại ⇒ round(out×rate,2)', () => {
    expect(amountInTuRate('USD', 'CNY', D(100), D(7)).toString()).toBe('700');
  });
  test('biên làm tròn nửa xa 0 — đích VND, dương: out×rate=0,005 ⇒ 0,01', () => {
    expect(amountInTuRate('USD', 'VND', D('0.005'), D(1)).toString()).toBe('0.01');
  });
  test('biên làm tròn nửa xa 0 — nguồn VND, âm: -2500000/25000 kết quả tròn xa 0', () => {
    expect(amountInTuRate('VND', 'USD', D(-2500000), D(25000)).toString()).toBe('-100');
  });
});

// ───────────────────────── viPhiFx (§3.2 dòng 151, §5.1) ─────────────────────────
describe('viPhiFx($fx) — cls.approval.php:5542-5550: phí ở ví ĐÍCH khi fee_currency==to_currency (UPPER/TRIM) và from!=to; ngược lại ví NGUỒN', () => {
  test('fee_currency == to_currency (khác from) ⇒ ví ĐÍCH', () => {
    const r = viPhiFx({ fromTk: 'TK01', toTk: 'TK02', fromCurrency: 'VND', toCurrency: 'CNY', feeCurrency: 'CNY' });
    expect(r.feeTk).toBe('TK02');
    expect(r.isDest).toBe(true);
  });
  test('fee_currency != to_currency ⇒ ví NGUỒN', () => {
    const r = viPhiFx({ fromTk: 'TK01', toTk: 'TK02', fromCurrency: 'VND', toCurrency: 'CNY', feeCurrency: 'VND' });
    expect(r.feeTk).toBe('TK01');
    expect(r.isDest).toBe(false);
  });
  test('so khớp không phân biệt hoa/thường + khoảng trắng (UPPER/TRIM)', () => {
    const r = viPhiFx({ fromTk: 'TK01', toTk: 'TK02', fromCurrency: 'VND', toCurrency: 'CNY', feeCurrency: ' cny ' });
    expect(r.feeTk).toBe('TK02');
  });
  test('from_currency == to_currency ⇒ luôn ví NGUỒN dù fee_currency khớp to_currency (điều kiện "và from≠to")', () => {
    const r = viPhiFx({ fromTk: 'TK01', toTk: 'TK02', fromCurrency: 'VND', toCurrency: 'VND', feeCurrency: 'VND' });
    expect(r.feeTk).toBe('TK01');
    expect(r.isDest).toBe(false);
  });
});

// ───────────────────────── fxKiemAgent (§5.3 điểm 7) ─────────────────────────
describe('fxKiemAgent — fx_ghiso.php:16-34: chặng 2 chỉ khi ví đích có quy_doi_sang≠""', () => {
  const toAcc = { tk: 'TK08', currency: 'USD', quyDoiSang: 'TK02' };
  const agentAccOk = { tk: 'TK02', currency: 'CNY', isActive: true };

  test('quy_doi_sang rỗng ⇒ không cần chặng 2', () => {
    const r = fxKiemAgent({ tk: 'TK01', currency: 'VND', quyDoiSang: '' }, agentAccOk, D(7), D(1000));
    expect(r.required).toBe(false);
  });

  test('quy_doi_sang có nhưng agent_rate<=0 ⇒ lỗi', () => {
    const r = fxKiemAgent(toAcc, agentAccOk, D(0), D(1000));
    expect(r.required).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/agent_rate/);
  });

  test('ví quy đổi không tồn tại (null) ⇒ lỗi', () => {
    const r = fxKiemAgent(toAcc, null, D(7), D(1000));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/không tồn tại|not.*found/i);
  });

  test('ví quy đổi is_active=false ⇒ lỗi', () => {
    const r = fxKiemAgent(toAcc, { ...agentAccOk, isActive: false }, D(7), D(1000));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/is_active|khoá|inactive/i);
  });

  test('ví quy đổi CÙNG tệ với ví đích ⇒ lỗi ("khác tệ")', () => {
    const r = fxKiemAgent(toAcc, { tk: 'TK09', currency: 'USD', isActive: true }, D(7), D(1000));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tệ|currency/i);
  });

  test('agent_rate không qua kiemTyGiaFx (USD→CNY, rate=67 > biên 14) ⇒ lỗi, thông điệp = msg của kiemTyGiaFx', () => {
    const r = fxKiemAgent(toAcc, agentAccOk, D(67), D(1000));
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Tỷ giá 67,0000 không hợp lý cho cặp USD → CNY: 1 USD phải bằng khoảng 3,33 – 14,00 CNY.');
  });

  test('hợp lệ ⇒ ok=true, agent_amount = round(amount_in × agent_rate, 2)', () => {
    const r = fxKiemAgent(toAcc, agentAccOk, D(7), D('1000.005'));
    expect(r.required).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.agentAmount!.toString()).toBe('7000.04'); // 1000.005*7=7000.035 ⇒ tròn xa 0 = 7000.04
  });

  test('biên làm tròn agent_amount nửa xa 0', () => {
    const r = fxKiemAgent(toAcc, agentAccOk, D(10), D('100.0025'));
    expect(r.ok).toBe(true);
    expect(r.agentAmount!.toString()).toBe('1000.03'); // 100.0025*10=1000.025 ⇒ tròn xa 0 = 1000.03
  });
});

// ───────────────────────── rateSuyNguoc (§5.4 suaTruocGhiSoFx) ─────────────────────────
describe('rateSuyNguoc — suaTruocGhiSoFx: effectiveOut = tongtien - (fee_currency==from?fee:0)', () => {
  test('effectiveOut <= 0 ⇒ lỗi', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(100), fee: D(100), feeCurrency: 'VND', amountIn: D(10),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/effectiveOut|<=\s*0|hợp lệ/i);
  });

  test('cùng tệ: |effectiveOut-amount_in|>0,01 ⇒ lỗi', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'VND', tongTien: D(1000), fee: D(0), feeCurrency: 'VND', amountIn: D(900),
    });
    expect(r.ok).toBe(false);
  });
  test('cùng tệ: |effectiveOut-amount_in|<=0,01 ⇒ rate=1', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'VND', tongTien: D(1000), fee: D(0), feeCurrency: 'VND', amountIn: D('999.99'),
    });
    expect(r.ok).toBe(true);
    expect(r.rate!.toString()).toBe('1');
    expect(r.effectiveOut.toString()).toBe('1000');
  });

  test('nguồn VND: rate = effectiveOut ÷ amount_in (amount_in cố định)', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(2500000), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
    });
    expect(r.ok).toBe(true);
    expect(r.rate!.toString()).toBe('25000');
  });

  test('fee ở từ tệ nguồn (fee_currency==from_currency) ⇒ trừ fee khỏi effectiveOut', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(2510000), fee: D(10000), feeCurrency: 'VND', amountIn: D(100),
    });
    expect(r.effectiveOut.toString()).toBe('2500000');
    expect(r.rate!.toString()).toBe('25000');
  });

  test('fee ở tệ khác from_currency ⇒ không trừ khỏi effectiveOut', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(2500000), fee: D(10), feeCurrency: 'USD', amountIn: D(100),
    });
    expect(r.effectiveOut.toString()).toBe('2500000');
  });

  test('khác (đích VND hoặc ngoại↔ngoại, không phải nguồn VND): rate = amount_in ÷ effectiveOut', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'USD', toCurrency: 'VND', tongTien: D(100), fee: D(0), feeCurrency: 'VND', amountIn: D(2500000),
    });
    expect(r.ok).toBe(true);
    expect(r.rate!.toString()).toBe('25000');
  });

  test('rate suy ngược không qua kiemTyGiaFx (USD/VND ngoài biên) ⇒ lỗi, msg = thông điệp kiemTyGiaFx', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'USD', toCurrency: 'VND', tongTien: D(100), fee: D(0), feeCurrency: 'VND', amountIn: D(4000000), // rate 40000 > 35000
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe(
      'Tỷ giá 40.000,00 không hợp lý cho ví USD: VND/USD phải nằm trong khoảng 20.000 – 35.000.' +
        ' Tỷ giá này trông giống tỷ giá EUR — có phải bạn định chọn ví EUR không?',
    );
  });

  test('needConfirm: |rate - nearestRate|/nearestRate > 20% và chưa xacnhanTyGia ⇒ true (§5.3 điểm 6)', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(3000000), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
      nearestRateForPair: D(25000), xacnhanTyGia: false,
    });
    // rate = 30000; |30000-25000|/25000 = 0.2 đúng biên ⇒ KHÔNG > 20% ⇒ false
    expect(r.needConfirm).toBe(false);
  });
  test('needConfirm: vượt quá 20% ⇒ true', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(3000001), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
      nearestRateForPair: D(25000), xacnhanTyGia: false,
    });
    expect(r.needConfirm).toBe(true);
  });
  test('needConfirm: vượt 20% nhưng xacnhanTyGia=true ⇒ false (đã xác nhận)', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(3000001), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
      nearestRateForPair: D(25000), xacnhanTyGia: true,
    });
    expect(r.needConfirm).toBe(false);
  });
  test('needConfirm: không có nearestRateForPair (không có phiếu cùng cặp trước đó) ⇒ false, không suy', () => {
    const r = rateSuyNguoc({
      fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(3000000), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
    });
    expect(r.needConfirm).toBe(false);
  });

  // ── changed (fix round 1 — công thức chính xác từ prod cls.approval.php) ──
  const base = {
    fromCurrency: 'VND', toCurrency: 'USD', tongTien: D(2500000), fee: D(0), feeCurrency: 'VND', amountIn: D(100),
  };
  test('không có `old` ⇒ changed = undefined (không suy diễn)', () => {
    const r = rateSuyNguoc(base);
    expect(r.changed).toBeUndefined();
  });
  test('cả 3 điều kiện khớp `old` (trong dung sai) ⇒ changed:false', () => {
    const r = rateSuyNguoc({
      ...base,
      old: { amountOut: D(2500000), fee: D(0), feeCurrency: 'VND' },
    });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(false);
  });
  test('lệch effectiveOut vs old.amountOut >= 0,01 (một mình) ⇒ changed:true', () => {
    const r = rateSuyNguoc({
      ...base,
      old: { amountOut: D(2500000).plus('0.02'), fee: D(0), feeCurrency: 'VND' },
    });
    expect(r.changed).toBe(true);
  });
  test('lệch effectiveOut vs old.amountOut < 0,01 (trong dung sai) ⇒ vẫn coi là khớp (nếu 2 điều kiện kia cũng khớp)', () => {
    const r = rateSuyNguoc({
      ...base,
      old: { amountOut: D(2500000).plus('0.005'), fee: D(0), feeCurrency: 'VND' },
    });
    expect(r.changed).toBe(false);
  });
  test('lệch fee vs old.fee >= 0,00001 (một mình) ⇒ changed:true', () => {
    const r = rateSuyNguoc({
      ...base,
      fee: D('0.0001'),
      old: { amountOut: D(2500000).minus('0.0001'), fee: D(0), feeCurrency: 'VND' },
    });
    // fee mới 0.0001 nhưng feeCurrency='VND'===from ⇒ trừ vào effectiveOut, effectiveOut = 2500000-0.0001
    // old.amountOut khớp effectiveOut mới (đặt bằng đúng effectiveOut mới) ⇒ điều kiện 1 khớp;
    // điều kiện 2 (|fee-old.fee|<0,00001): |0.0001-0| = 0.0001 >= 0.00001 ⇒ lệch riêng fee ⇒ changed:true
    expect(r.changed).toBe(true);
  });
  test('lệch feeCurrency (một mình, fee=0 nên effectiveOut/fee không đổi) ⇒ changed:true', () => {
    const r = rateSuyNguoc({
      ...base,
      old: { amountOut: D(2500000), fee: D(0), feeCurrency: 'USD' },
    });
    expect(r.changed).toBe(true);
  });
});
