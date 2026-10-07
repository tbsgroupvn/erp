/**
 * Thứ tự chép ngược = thứ tự nạp xuôi (cha → con): 09b → 09c → 09a → 04b.
 * MySQL prod không có FK nên thứ tự chỉ để dễ đọc/khôi phục từng phần — vẫn
 * giữ đúng thứ tự cha → con như kế hoạch L13.
 */
import { COPYBACK_FX_BANK } from './fx-bank';
import { COPYBACK_RETURN } from './return-state';
import { CopybackSpec } from './spec';
import { COPYBACK_SUPPLIER_PAYMENT } from './supplier-payment';
import { COPYBACK_TREASURY } from './treasury';

export const COPYBACK_TABLES: readonly CopybackSpec[] = [
  ...COPYBACK_TREASURY,
  ...COPYBACK_FX_BANK,
  ...COPYBACK_SUPPLIER_PAYMENT,
  ...COPYBACK_RETURN,
];
