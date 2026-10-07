/**
 * L0 Task 3 — sổ cổng đầy đủ theo thứ tự chạy: NGUỒN (§7, sai là DỪNG) → ĐÍCH mức cột (§8) → G-DOC →
 * số vàng 09d §9.
 */
import { GOLDEN_GATES } from './golden';
import { GDOC_GATES, SOURCE_GATES } from './source-gates';
import { TARGET_GATES } from './target-gates';
import { Gate } from './types';

export const ALL_GATES: readonly Gate[] = [...SOURCE_GATES, ...TARGET_GATES, ...GDOC_GATES, ...GOLDEN_GATES];
