// src/money/fx-rules.ts
//
// 09c L2, Task 1 — hàm THUẦN của lõi ghi sổ phiếu FX (không CSDL, không I/O).
// Đặc tả: docs/rewrite-spec/09c-fx-ngan-hang.md §5.1–5.4, §10.2 (danh sách hàm),
//         §12 (bẫy), §14 (đã ĐO/CHẠY/SUY — ca #053).
// Kế hoạch: docs/rewrite-spec/plans/2026-09-25-09c-L2-fx-core-plan.md — Task 1.
// Fix round 1 (coordinator, đọc thẳng prod HEAD `libs/cls.treasury.php:194-247`,
// `libs/cls.approval.php:2540+`, 1 SELECT): thay 3 mục NEEDS_CONTEXT của lượt đầu bằng
// công thức/thông điệp CHÍNH XÁC đọc từ prod — xem ghi chú tại từng hàm bên dưới.
//
// Tiền/tỷ giá: Prisma.Decimal suốt (không `number`). Làm tròn PHP `round()` = NỬA XA 0
// (ROUND_HALF_UP trên trị tuyệt đối) — dùng `decimal.js` `Decimal.ROUND_HALF_UP`, vốn đã
// đúng ngữ nghĩa "half away from zero" và không có bẫy nhiễu biểu diễn nhị phân của
// `number` (xem src/common/money.ts IMPORTANT 3 — KHÔNG sửa file đó, không dùng `phpRound`
// vì nó nhận `number`, không phải Decimal).
import { Prisma } from '@prisma/client';

type Dec = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/** PHP `round($v, $dp)` = nửa xa 0 (ROUND_HALF_UP), khớp trên cả số âm. */
function roundHalfUp(v: Dec, dp: number): Dec {
  return v.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
}

function normCur(cur: string): string {
  return (cur ?? '').trim().toUpperCase();
}

/**
 * PHP `number_format($v, $decimals, ',', '.')` — thousands '.', thập phân ','; làm tròn nửa xa 0.
 * Bộ định dạng DUY NHẤT cho chuỗi tiền kiểu prod (fx-rules + TreasuryService dùng chung; `tbs_money`
 * của prod = `number_format(n, 0, ',', '.')`). Số âm giữ dấu '-'; kết quả làm tròn về 0 KHÔNG mang
 * dấu (PHP 8 number_format không trả "-0").
 */
export function numberFormatVn(v: Dec, decimals: number): string {
  const rounded = roundHalfUp(v, decimals);
  const fixed = rounded.toFixed(decimals);
  const [intPartRaw, fracPart] = fixed.split('.');
  const neg = intPartRaw.startsWith('-') && !rounded.isZero();
  const digits = intPartRaw.replace(/^-/, '');
  const withThousands = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = neg ? '-' : '';
  return decimals > 0 ? `${sign}${withThousands},${fracPart}` : `${sign}${withThousands}`;
}

// ─────────────────────────────────────────────────────────────────────────
// bienTyGiaVnd(cur) — biên cứng tỷ giá NGOẠI TỆ ↔ VND.
// Fix round 1 — coordinator đọc thẳng `cls.treasury.php:194-247` trên prod, bảng đầy đủ:
//   USD [20.000;35.000], CNY [2.500;6.000], EUR [20.000;45.000], JPY [100;400], KRW [10;50].
// Tệ KHÔNG có trong bảng ⇒ trả `null` (KHÔNG ném lỗi — khác lượt đầu, đã sửa theo chỉ dẫn).
// ─────────────────────────────────────────────────────────────────────────
const BIEN_TY_GIA_VND_CUNG: Record<string, [string, string]> = {
  USD: ['20000', '35000'],
  CNY: ['2500', '6000'],
  EUR: ['20000', '45000'],
  JPY: ['100', '400'],
  KRW: ['10', '50'],
};
/** Thứ tự tra "gợi ý" (goiy) trong thông điệp lỗi kiemTyGiaFx — đúng thứ tự prod. */
const TATCA_TE_CO_BIEN = ['USD', 'CNY', 'EUR', 'JPY', 'KRW'];

export function bienTyGiaVnd(cur: string): [Dec, Dec] | null {
  const c = normCur(cur);
  const b = BIEN_TY_GIA_VND_CUNG[c];
  if (!b) return null;
  return [new Decimal(b[0]), new Decimal(b[1])];
}

/** "gợi ý" (goiy) — c đầu tiên ≠ ngoai mà bien(c) chứa rate. '' nếu không có. */
function goiYTyGia(rate: Dec, ngoai: string): string {
  for (const c of TATCA_TE_CO_BIEN) {
    if (c === ngoai) continue;
    const b = bienTyGiaVnd(c);
    if (b && rate.gte(b[0]) && rate.lte(b[1])) {
      return ` Tỷ giá này trông giống tỷ giá ${c} — có phải bạn định chọn ví ${c} không?`;
    }
  }
  return '';
}

export interface KiemTyGiaFxResult {
  ok: boolean;
  msg: string;
}

// ─────────────────────────────────────────────────────────────────────────
// kiemTyGiaFx(fromCur, toCur, rate) — `cls.treasury.php:210-249` (fix round 1: đọc lại
// `:194-247` trên prod, thứ tự + thông điệp CHÍNH XÁC do coordinator cung cấp verbatim):
//   from/to = strtoupper(trim)
//   rate<=0 ⇒ {ok:false,'Tỷ giá phải lớn hơn 0.'}
//   from===to ⇒ |rate−1|>0.0001 ⇒ {ok:false,'Hai ví cùng loại tiền (X) thì tỷ giá phải là 1.'}
//              else: KHÔNG return true — rơi tiếp xuống các khối sau (có thể vẫn VND==VND
//              hoặc tệ==tệ ngoài VND, hai khối dưới đều tự nhiên "rơi qua" vì cùng biên).
//   if from==='VND' || to==='VND':
//     ngoai = tệ không phải VND (nếu cả hai đều VND thì "ngoai"='VND', bienTyGiaVnd('VND')
//     luôn null ⇒ SKIP)
//     b = bienTyGiaVnd(ngoai); b===null ⇒ SKIP (rơi xuống return cuối)
//     rate<b0 || rate>b1 ⇒ {ok:false, msg: "...biên...${goiy}"}
//     (trong biên: KHÔNG return true ở đây — rơi xuống return cuối, khối else dưới không
//     áp dụng vì một bên là VND)
//   else (ngoại↔ngoại, cả hai ≠ VND):
//     ba=bienTyGiaVnd(from); bb=bienTyGiaVnd(to)
//     nếu CẢ HAI không null: lo=ba0/bb1; hi=ba1/bb0; rate<lo||rate>hi ⇒ {ok:false,msg:"..."}
//     một trong hai null ⇒ SKIP (rơi xuống return cuối)
//   return {ok:true, msg:''}
// Nhánh ngoại↔ngoại là code MỚI trên prod (24/09) — giữ nguyên (không phải P-FX cũ).
// ─────────────────────────────────────────────────────────────────────────
export function kiemTyGiaFx(fromCur: string, toCur: string, rate: Dec): KiemTyGiaFxResult {
  const from = normCur(fromCur);
  const to = normCur(toCur);

  if (rate.lte(0)) {
    return { ok: false, msg: 'Tỷ giá phải lớn hơn 0.' };
  }

  if (from === to) {
    if (rate.minus(1).abs().gt('0.0001')) {
      return { ok: false, msg: `Hai ví cùng loại tiền (${from}) thì tỷ giá phải là 1.` };
    }
    // else: không return true ở đây — rơi tiếp xuống khối VND/ngoại↔ngoại bên dưới.
  }

  if (from === 'VND' || to === 'VND') {
    const ngoai = from === 'VND' ? to : from;
    const b = bienTyGiaVnd(ngoai);
    if (b) {
      const [b0, b1] = b;
      if (rate.lt(b0) || rate.gt(b1)) {
        const goiy = goiYTyGia(rate, ngoai);
        return {
          ok: false,
          msg:
            `Tỷ giá ${numberFormatVn(rate, 2)} không hợp lý cho ví ${ngoai}: VND/${ngoai} phải nằm trong khoảng ` +
            `${numberFormatVn(b0, 0)} – ${numberFormatVn(b1, 0)}.${goiy}`,
        };
      }
      // trong biên: rơi xuống return cuối (KHÔNG return ok ở đây — đúng như prod).
    }
    // b===null: SKIP, rơi xuống return cuối.
  } else {
    // ngoại↔ngoại (cả hai ≠ VND)
    const ba = bienTyGiaVnd(from);
    const bb = bienTyGiaVnd(to);
    if (ba && bb) {
      const lo = ba[0].div(bb[1]);
      const hi = ba[1].div(bb[0]);
      if (rate.lt(lo) || rate.gt(hi)) {
        return {
          ok: false,
          msg:
            `Tỷ giá ${numberFormatVn(rate, 4)} không hợp lý cho cặp ${from} → ${to}: 1 ${from} phải bằng khoảng ` +
            `${numberFormatVn(lo, 2)} – ${numberFormatVn(hi, 2)} ${to}.`,
        };
      }
    }
    // một trong hai null: SKIP, rơi xuống return cuối.
  }

  return { ok: true, msg: '' };
}

// ─────────────────────────────────────────────────────────────────────────
// tinhPhiFxPercent(base, pct, cur) — đặc tả §5.3 điểm 4 (dòng 242, `:97-108`):
//   round(base×pct/100, cur=='VND' ? 0 : 2)
// (Lựa chọn `base`/`cur` theo dst/src là việc của NGƯỜI GỌI — đã nêu trong đặc tả,
// không phải logic bên trong hàm này.)
// ─────────────────────────────────────────────────────────────────────────
export function tinhPhiFxPercent(base: Dec, pct: Dec, cur: string): Dec {
  const raw = base.mul(pct).div(100);
  const dp = normCur(cur) === 'VND' ? 0 : 2;
  return roundHalfUp(raw, dp);
}

// ─────────────────────────────────────────────────────────────────────────
// amountInTuRate(fromCur, toCur, amountOut, rate) — đặc tả §5.3 điểm 3 (§5.3.3 theo
// brief; dòng 241, `process_fx_transfer.php:81-92`):
//   cùng tệ ⇒ = amount_out
//   đích VND ⇒ round(out×rate,2)
//   nguồn VND ⇒ round(out÷rate,2)
//   ngoại↔ngoại ⇒ round(out×rate,2)
// ─────────────────────────────────────────────────────────────────────────
export function amountInTuRate(fromCur: string, toCur: string, amountOut: Dec, rate: Dec): Dec {
  const from = normCur(fromCur);
  const to = normCur(toCur);

  if (from === to) return amountOut;
  if (to === 'VND') return roundHalfUp(amountOut.mul(rate), 2);
  if (from === 'VND') return roundHalfUp(amountOut.div(rate), 2);
  return roundHalfUp(amountOut.mul(rate), 2); // ngoại↔ngoại
}

// ─────────────────────────────────────────────────────────────────────────
// viPhiFx($fx) — `cls.approval.php:5542-5550`, đặc tả dòng 151 + §5.1 dòng 199:
//   phí ở ví ĐÍCH khi UPPER(TRIM(fee_currency)) == UPPER(TRIM(to_currency)) VÀ
//   from_currency ≠ to_currency; ngược lại ví NGUỒN.
// Trả `{feeTk, isDest}` — tuple `(feeTk,_)` trong pseudocode §5.1 chỉ dùng phần tử đầu
// ở người gọi hiện có; `isDest` là cờ tường minh cho phần tử thứ hai (không đổi công thức).
// ─────────────────────────────────────────────────────────────────────────
export interface ViPhiFxInput {
  fromTk: string;
  toTk: string;
  fromCurrency: string;
  toCurrency: string;
  feeCurrency: string;
}
export interface ViPhiFxResult {
  feeTk: string;
  isDest: boolean;
}

export function viPhiFx(fx: ViPhiFxInput): ViPhiFxResult {
  const from = normCur(fx.fromCurrency);
  const to = normCur(fx.toCurrency);
  const fee = normCur(fx.feeCurrency);
  const isDest = fee === to && from !== to;
  return { feeTk: isDest ? fx.toTk : fx.fromTk, isDest };
}

// ─────────────────────────────────────────────────────────────────────────
// fxKiemAgent(toAcc, agentAcc, agentRate, amountIn) — `fx_kiem_agent`, `fx_ghiso.php:16-34`,
// đặc tả §5.3 điểm 7 (dòng 245):
//   chỉ khi ví đích có quy_doi_sang≠'' (TK08→TK02, TK11→TK10):
//   bắt buộc agent_rate>0, ví quy đổi tồn tại, is_active=1, khác tệ, qua kiemTyGiaFx;
//   agent_amount = round(amount_in×agent_rate,2)
// ─────────────────────────────────────────────────────────────────────────
export interface FxAgentToAcc {
  tk: string;
  currency: string;
  quyDoiSang: string;
}
export interface FxAgentAcc {
  tk: string;
  currency: string;
  isActive: boolean;
}
export interface FxKiemAgentResult {
  /** true nếu ví đích có `quy_doi_sang` ≠ '' (chặng 2 áp dụng). */
  required: boolean;
  ok: boolean;
  error?: string;
  agentAmount?: Dec;
}

export function fxKiemAgent(
  toAcc: FxAgentToAcc,
  agentAcc: FxAgentAcc | null | undefined,
  agentRate: Dec,
  amountIn: Dec,
): FxKiemAgentResult {
  const quyDoiSang = (toAcc.quyDoiSang ?? '').trim();
  if (quyDoiSang === '') {
    return { required: false, ok: true };
  }

  if (!agentRate.gt(0)) {
    return { required: true, ok: false, error: 'agent_rate phải > 0' };
  }
  if (!agentAcc) {
    return { required: true, ok: false, error: 'ví quy đổi (agent) không tồn tại' };
  }
  if (!agentAcc.isActive) {
    return { required: true, ok: false, error: 'ví quy đổi (agent) không is_active (khoá)' };
  }
  if (normCur(agentAcc.currency) === normCur(toAcc.currency)) {
    return { required: true, ok: false, error: 'ví quy đổi (agent) phải KHÁC tệ với ví đích' };
  }
  const rateCheck = kiemTyGiaFx(toAcc.currency, agentAcc.currency, agentRate);
  if (!rateCheck.ok) {
    return { required: true, ok: false, error: rateCheck.msg };
  }

  const agentAmount = roundHalfUp(amountIn.mul(agentRate), 2);
  return { required: true, ok: true, agentAmount };
}

// ─────────────────────────────────────────────────────────────────────────
// rateSuyNguoc — `suaTruocGhiSoFx`, `cls.approval.php:2540+` (fix round 1: coordinator đọc
// thẳng prod), đặc tả §5.4 (dòng 257-267):
//   effectiveOut = tongtien − (fee_currency==from_currency ? fee : 0);  <=0 ⇒ lỗi
//   cùng tệ: |effectiveOut − amount_in| > 0,01 ⇒ lỗi; rate=1
//   nguồn VND: rate = effectiveOut ÷ amount_in          // amount_in CỐ ĐỊNH
//   khác:      rate = amount_in ÷ effectiveOut
//   kiemTyGiaFx + need_confirm (20%) ; không đổi gì ⇒ {changed:false}
//
// `need_confirm` dùng công thức §5.3 điểm 6 (dòng 244):
//   need_confirm khi |rate − rate phiếu cùng cặp gần nhất|/gần nhất > 20% và chưa
//   xacnhan_tygia=1. "rate phiếu cùng cặp gần nhất" là dữ liệu CSDL (không thuần) ⇒ nhận
//   qua tham số `nearestRateForPair` (do người gọi/CSDL cung cấp) thay vì tự truy vấn.
//
// `changed` (fix round 1 — công thức chính xác từ prod, coordinator cung cấp verbatim):
//   fcur = strtoupper(trim(fee_currency)); fcur0 = strtoupper(trim(old.feeCurrency))
//   unchanged ⇔ |effectiveOut − old.amountOut| < 0,01 AND |fee − old.fee| < 0,00001
//               AND fcur === fcur0
//   ⇒ changed = !unchanged. `rate` KHÔNG nằm trong so sánh này.
//   Chỉ tính khi có `old` (baseline) — không suy diễn hành vi khi thiếu baseline.
// ─────────────────────────────────────────────────────────────────────────
export interface RateSuyNguocOld {
  /** `amount_out` hiện có trên phiếu TRƯỚC khi sửa. */
  amountOut: Dec;
  fee: Dec;
  feeCurrency: string;
}
export interface RateSuyNguocInput {
  fromCurrency: string;
  toCurrency: string;
  tongTien: Dec;
  fee: Dec;
  feeCurrency: string;
  /** amount_in CỐ ĐỊNH (không đổi bởi hàm này — spec: "amount_in CỐ ĐỊNH"). */
  amountIn: Dec;
  /** rate phiếu CÙNG CẶP gần nhất — dữ liệu CSDL, người gọi cung cấp (có thể vắng). */
  nearestRateForPair?: Dec;
  xacnhanTyGia?: boolean;
  /** Giá trị hiện có trên phiếu trước sửa — dùng để tính `changed`. Không có ⇒ không tính. */
  old?: RateSuyNguocOld;
}
export interface RateSuyNguocResult {
  ok: boolean;
  error?: string;
  effectiveOut: Dec;
  rate?: Dec;
  needConfirm: boolean;
  /** `undefined` khi không có `old` (không đủ dữ liệu để so "không đổi gì"). */
  changed?: boolean;
}

export function rateSuyNguoc(input: RateSuyNguocInput): RateSuyNguocResult {
  const from = normCur(input.fromCurrency);
  const to = normCur(input.toCurrency);
  const feeCur = normCur(input.feeCurrency);

  const feeTruDiNguon = feeCur === from ? input.fee : new Decimal(0);
  const effectiveOut = input.tongTien.minus(feeTruDiNguon);

  const changed = input.old
    ? !(
        effectiveOut.minus(input.old.amountOut).abs().lt('0.01') &&
        input.fee.minus(input.old.fee).abs().lt('0.00001') &&
        feeCur === normCur(input.old.feeCurrency)
      )
    : undefined;

  if (effectiveOut.lte(0)) {
    return { ok: false, error: 'effectiveOut <= 0', effectiveOut, needConfirm: false, changed };
  }

  let rate: Dec;
  if (from === to) {
    if (effectiveOut.minus(input.amountIn).abs().gt('0.01')) {
      return {
        ok: false,
        error: 'cùng tệ nhưng |effectiveOut - amount_in| > 0,01',
        effectiveOut,
        needConfirm: false,
        changed,
      };
    }
    rate = new Decimal(1);
  } else if (from === 'VND') {
    rate = effectiveOut.div(input.amountIn);
  } else {
    rate = input.amountIn.div(effectiveOut);
  }

  const rateCheck = kiemTyGiaFx(from, to, rate);
  if (!rateCheck.ok) {
    return { ok: false, error: rateCheck.msg, effectiveOut, rate, needConfirm: false, changed };
  }

  let needConfirm = false;
  if (input.nearestRateForPair && input.nearestRateForPair.gt(0) && !input.xacnhanTyGia) {
    const pct = rate.minus(input.nearestRateForPair).abs().div(input.nearestRateForPair);
    needConfirm = pct.gt('0.2');
  }

  return { ok: true, effectiveOut, rate, needConfirm, changed };
}
