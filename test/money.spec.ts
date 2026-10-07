import { DUNG_SAI_AM, isTestCustomer, toVnd, WALLET_BIZ_TYPE, phpRound } from '../src/common/money';

test('tolerance = 5000', () => expect(DUNG_SAI_AM).toBe(5000n));

test('ZZ customer is test', () => {
  expect(isTestCustomer('ZZQA_1')).toBe(true);
  expect(isTestCustomer('TBS123')).toBe(false);
});

test('toVnd rounds to integer bigint', () => {
  expect(toVnd(19_500_000.4)).toBe(19_500_000n);
  expect(toVnd('19500000')).toBe(19_500_000n);
});

test('biz type map', () => {
  expect(WALLET_BIZ_TYPE[1]).toBe('wallet_tt');
  expect(WALLET_BIZ_TYPE[4]).toBe('wallet_po');
});

// ⚠⚠⚠ IMPORTANT 3 (#08 fix-round-2, 23/09/2026) — phpRound() phải khớp
// PHP round() thật, đo trên prod PHP 8.2 bởi coordinator, KHÔNG phải
// Math.round(v*10**d)/10**d (naive) vốn sai ở hai chỗ riêng biệt: (1)
// không pre-round bù nhiễu biểu diễn IEEE-754, (2) Math.round tự thân làm
// tròn .5 ÂM về phía +Infinity chứ không phải "xa số 0" như PHP.
describe('phpRound — khớp PHP round() thật, không phải Math.round(v*100)/100', () => {
  it('round(1.005, 2) = 1.01 ở PHP — naive JS cho 1.00 vì 1.005 lưu dạng 1.00499999999999989...', () => {
    expect(phpRound(1.005, 2)).toBe(1.01);
    expect(Math.round(1.005 * 100) / 100).toBe(1); // naive SAI — pin lại để không ai "sửa" phpRound về dạng này
  });

  it('round(-0.125, 2) = -0.13 ở PHP (nửa xa số 0) — naive JS cho -0.12 vì Math.round(-12.5)=-12', () => {
    expect(phpRound(-0.125, 2)).toBe(-0.13);
    expect(Math.round(-0.125 * 100) / 100).toBe(-0.12); // naive SAI
  });

  it('nửa dương làm tròn LÊN (2.5->3), nửa âm làm tròn XA số 0 (-2.5->-3) — nhất quán "xa số 0" cả hai chiều', () => {
    expect(phpRound(2.5, 0)).toBe(3);
    expect(phpRound(-2.5, 0)).toBe(-3);
  });

  it('giá trị KHÔNG ở biên .5 giữ nguyên hành vi làm tròn thông thường', () => {
    expect(phpRound(1.234, 2)).toBe(1.23);
    expect(phpRound(1.236, 2)).toBe(1.24);
    expect(phpRound(0, 2)).toBe(0);
    expect(phpRound(100, 2)).toBe(100);
  });

  it('không phá vỡ ca đã biết trong quote-calc.ts (105008.49999999999999 -> 105009, PHP pre-round)', () => {
    expect(phpRound(105008.49999999999999, 0)).toBe(105009);
  });
});
