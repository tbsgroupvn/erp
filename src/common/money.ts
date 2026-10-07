export const DUNG_SAI_AM = 5000n;

export const WALLET_BIZ_TYPE: Record<number, string> = {
  0: 'wallet_nap', 1: 'wallet_tt', 2: 'wallet_coc',
  [-2]: 'wallet_hoan', [-3]: 'wallet_rut', 3: 'wallet_phi', 4: 'wallet_po',
};

export function isTestCustomer(cusId: string): boolean {
  return /^ZZ/i.test((cusId ?? '').trim());
}

export function toVnd(x: number | string | bigint): bigint {
  if (typeof x === 'bigint') return x;
  return BigInt(Math.round(Number(x)));
}

export function nowSec(): number { return Math.floor(Date.now() / 1000); }

// ⚠⚠⚠ IMPORTANT 3 (#08 fix-round-2, 23/09/2026) — `Math.round(v * 10**d) /
// 10**d` is NOT PHP's `round()`. PHP pre-corrects IEEE-754 representation
// noise before applying half-away-from-zero rounding; naive JS does not,
// and `Math.round` itself rounds negative .5 toward +Infinity (banker-ish
// for negatives) instead of away from zero. Measured on prod PHP 8.2
// (coordinator, fix-round-2): `round(1.005, 2)` = 1.01 but
// `Math.round(1.005*100)/100` = 1.00 (1.005 is stored as
// 1.00499999999999989... in a double, so the naive multiply-then-round
// sees 100.49999999999999, not 100.5); `round(-0.125, 2)` = -0.13 but the
// naive version gives -0.12 (Math.round(-12.5) = -12, not -13). Both
// examples verified against this implementation below and covered by
// test/money-php-round.spec.ts.
//
// Algorithm: work in the absolute value + sign (this alone fixes the
// half-away-from-zero direction for negatives, since Math.round on a
// positive number already rounds .5 up = away from zero). Re-render the
// scaled value at 15 significant digits (doubles reliably hold ~15-17;
// this is what strips the "...999999989" binary-representation noise
// while leaving genuine values untouched) before the final Math.round.
//
// ⚠ Shared on purpose so #05 (src/quote/quote-calc.ts,
// src/quote/import-tax.service.ts) and #08 (src/customs/) can both use
// ONE implementation instead of copy-pasting `Math.round(v*100)/100`
// (which is what #08's fix-round-1 did, copying the pattern from
// src/po/quote-po-diff.service.ts). #05 does NOT call this yet — its own
// `Math.round` calls have the identical flaw (confirmed, see
// quote-calc.ts's own comment acknowledging `Math.round(-0.5)` vs PHP's
// `round(-0.5)`), but #05's golden-case tests were validated against real
// prod PHP output with THAT exact (imperfect) arithmetic, so switching it
// to phpRound now would change #05's numbers without re-validating against
// prod — out of scope for this round. See #08 fix-round-2 report for the
// full note; do not change #05's rounding without a separate, deliberate
// task that re-runs the golden-case comparison.
export function phpRound(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, decimals);
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * factor;
  const corrected = Number(scaled.toPrecision(15));
  return (sign * Math.round(corrected)) / factor;
}

// ⚠ Task 4 (24/09/2026) — `x ?? null` KHÔNG gỡ sentinel: `0 ?? null === 0`, `'' ?? null === ''`.
// Prod (MySQL) lưu "không có" bằng 0/'' ở các cột id NOT NULL DEFAULT 0; migration NULLIF về NULL.
// Hệ mới phải ghi NULL cho "không có", nếu không một cột sẽ mang HAI quy ước cùng lúc.
// Chỉ dùng cho cột ID (id tự tăng từ 1 ⇒ 0/âm không bao giờ là id thật) — ĐỪNG dùng cho cột
// mà 0 là giá trị nghiệp vụ (type=0 là NẠP, dot=0, money, debit/credit, fx_rate…).
export function idOrNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
}

/** Mã (chuỗi) rỗng/chỉ khoảng trắng ⇒ NULL; mã thật giữ NGUYÊN (không trim giá trị lưu). */
export function codeOrNull(v: string | null | undefined): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}
