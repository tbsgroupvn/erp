import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * D3 — rẽ nhánh theo điều kiện, CHÉP prod `libs/cls.approval.php` (HEAD): evaluateBranches(),
 * evalConditionValue(), parseNum(); nơi gọi submitRequest().
 *
 * Định dạng `condition_json` trên prod là MẢNG:
 *   - mảng phẳng `[{field_key, operator, value}, …]`          = MỘT nhóm AND
 *   - mảng của mảng `[[{…},{…}], [{…}]]`                     = OR của các nhóm AND
 * Rỗng / không phải mảng ⇒ nhánh KHÔNG khớp (prod `continue`) — chỉ nhánh is_default hứng.
 */
@Injectable()
export class BranchEvaluator {
  constructor(private prisma: PrismaService) {}

  /** Nhánh (không phải mặc định) có khớp form_data không. Không bao giờ ném. */
  evaluate(conditionJson: string | null, formData: Record<string, any>): boolean {
    let conds: any;
    try { conds = JSON.parse(conditionJson || '[]'); } catch { return false; }
    if (!Array.isArray(conds) || conds.length === 0) return false;
    const first = conds[0];
    const isGroups = isObj(first) && (Array.isArray(first) || first.field_key == null);
    const groups: any[] = isGroups ? conds : [conds];
    const fd = formData ?? {};
    for (const group of groups) {
      if (!Array.isArray(group) || group.length === 0) continue;
      let gmatch = true;
      for (const c of group) {
        // Prod đọc thẳng $c['field_key'] — phần tử không phải điều kiện là cấu hình hỏng ⇒ không khớp.
        if (!isObj(c) || Array.isArray(c)) { gmatch = false; break; }
        const actual = fd[c.field_key] ?? '';
        if (!evalConditionValue(actual, c.operator, c.value)) { gmatch = false; break; }
      }
      if (gmatch) return true;
    }
    return false;
  }

  /**
   * null ⇒ mẫu không có nhóm nhánh (đi luồng chính). Prod chỉ dùng MỘT nhóm nhánh/mẫu
   * (getBranchGroupByTemplate LIMIT 1 — prod hiện có đúng 1 nhóm cho mỗi mẫu có nhánh); ở đây lấy
   * nhóm id nhỏ nhất cho tất định. Nhánh không mặc định xét theo priority TĂNG dần; mặc định chỉ
   * khi không nhánh nào khớp; không khớp + không có mặc định ⇒ TỪ CHỐI như prod (không lặng lẽ rơi
   * về luồng chính — luồng chính có thể là chuỗi duyệt khác hẳn).
   */
  async resolveBranch(templateId: number, formData: Record<string, any>): Promise<number | null> {
    const group = await this.prisma.approvalBranchGroup.findFirst({
      where: { templateId }, orderBy: { id: 'asc' }, include: { branches: true },
    });
    if (!group) return null;
    // prod getBranches(): ORDER BY is_default ASC, priority ASC; usort ổn định ⇒ hoà priority giữ thứ tự CSDL (id).
    const ordered = [...group.branches].sort((a, b) => a.priority - b.priority || a.id - b.id);
    for (const b of ordered) { if (!b.isDefault && this.evaluate(b.conditionJson, formData)) return b.id; }
    const defs = ordered.filter((b) => b.isDefault);
    if (defs.length) return defs[defs.length - 1].id; // prod: `$default = $b` ghi đè ⇒ mặc định CUỐI theo thứ tự trên
    throw new BadRequestException('Không tìm thấy nhánh phù hợp và chưa cấu hình nhánh mặc định — liên hệ admin cấu hình luồng.');
  }
}

function isObj(v: unknown): v is Record<string, any> { return typeof v === 'object' && v !== null; }

/** PHP `(string)$v` cho giá trị lấy từ JSON; mảng ⇒ implode(','). */
function phpStr(v: any): string {
  if (v === null || v === undefined || v === false) return '';
  if (v === true) return '1';
  if (Array.isArray(v)) return v.map(phpStr).join(',');
  if (isObj(v)) return Object.values(v).map(phpStr).join(',');
  return String(v);
}

/** Chuỗi số theo PHP 8 (khoảng trắng đầu/cuối cho phép). */
const PHP_NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/;

/** PHP 8 `$a == $e` giữa hai chuỗi: cả hai là chuỗi số ⇒ so GIÁ TRỊ, không thì so chuỗi chính xác. */
function phpLooseEq(a: string, e: string): boolean {
  if (PHP_NUMERIC.test(a) && PHP_NUMERIC.test(e)) return Number(a) === Number(e);
  return a === e;
}

/** prod parseNum(): đọc số kiểu VN ('5.000.000' → 5000000; '5,5' → 5.5). */
export function parseNum(s: any): number {
  let t = (Array.isArray(s) ? s.map(phpStr).join('') : phpStr(s)).replace(/[^0-9.,\-]/g, '');
  if (t === '' || t === '-') return 0;
  const hasC = t.includes(','), hasD = t.includes('.');
  if (hasC && hasD) { t = t.replace(/\./g, '').replace(/,/g, '.'); }
  else if (hasC) { t = (t.split(',').length - 1 > 1) ? t.replace(/,/g, '') : t.replace(',', '.'); }
  else if (hasD) {
    if (t.split('.').length - 1 > 1) t = t.replace(/\./g, '');
    else { const p = t.split('.'); if (p.length === 2 && p[1].length === 3) t = p[0] + p[1]; }
  }
  const n = parseFloat(t); // PHP floatval(): đọc tiền tố số, không đọc được ⇒ 0
  return Number.isNaN(n) ? 0 : n;
}

/** prod evalConditionValue(). */
function evalConditionValue(actual: any, operator: any, expected: any): boolean {
  switch (operator) {
    case '>': return parseNum(actual) > parseNum(expected);
    case '>=': return parseNum(actual) >= parseNum(expected);
    case '<': return parseNum(actual) < parseNum(expected);
    case '<=': return parseNum(actual) <= parseNum(expected);
  }
  const a = phpStr(actual);
  const e = phpStr(expected);
  if (operator === 'contains') return a.toLowerCase().includes(e.toLowerCase()); // mb_stripos
  if (operator === '!=') return !phpLooseEq(a, e);
  return phpLooseEq(a, e); // mặc định '='
}
