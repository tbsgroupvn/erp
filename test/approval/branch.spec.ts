import { prisma, resetApproval, seedTemplate, seedBranchGroup, seedBranch } from '../helpers/approval-db';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
const be = new BranchEvaluator(prisma as any);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());

/*
 * D3 — rẽ nhánh phải đọc ĐÚNG định dạng prod. Nguồn: prod `libs/cls.approval.php` HEAD —
 * evaluateBranches() + evalConditionValue() + parseNum(); gọi từ submitRequest() (chỉ một nhóm
 * nhánh/mẫu, getBranches() ORDER BY is_default ASC, priority ASC).
 *   - condition_json là MẢNG `[{field_key, operator, value}]` = MỘT nhóm AND; mảng-của-mảng
 *     `[[…],[…]]` = OR các nhóm AND.
 *   - rỗng / không phải mảng ⇒ nhánh KHÔNG khớp (bỏ qua), chỉ nhánh is_default hứng.
 *   - toán tử: > >= < <= (so số, đọc số kiểu VN), contains (không phân biệt hoa thường), !=,
 *     còn lại (kể cả '=') ⇒ so chuỗi kiểu PHP `==`.
 *   - priority TĂNG dần; is_default không dự thi; không nhánh nào khớp và không có mặc định ⇒ LỖI.
 *
 * Dữ liệu thật tbl_approval_branches (sql_nhpcn, 24/09/2026), dán NGUYÊN VĂN:
 *   nhóm 12 (adjustment_cost):
 *     27 "Khách chịu — lớn (≥5tr)"  p1 [{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"lon"}]
 *     28 "Khách chịu — nhỏ"         p2 [{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"nho"}]
 *     29 "TBS chịu — lớn (≥5tr)"    p3 [{"field_key":"bearer","operator":"=","value":"tbs"},{"field_key":"muc_tien","operator":"=","value":"lon"}]
 *     30 "TBS chịu — nhỏ (mặc định)" p4 default []
 *   nhóm 16 (phieu_xuat_kho):
 *     39 "Kho TBS Hà Nội" p1 [{"field_key":"kho_xu_ly","operator":"=","value":"TBS Hà Nội"}]
 *     40 "Kho TBS HCM"    p2 [{"field_key":"kho_xu_ly","operator":"=","value":"TBS HCM"}]
 *     41 "Không xác định kho — giữ nguyên nhóm kho vận" p3 default []
 * `muc_tien` do nơi gọi tính: ajaxs/adjustment/process_save.php `amount_vnd>=5000000 ? 'lon' : 'nho'`.
 */
const C27 = '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"lon"}]';
const C28 = '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"nho"}]';
const C29 = '[{"field_key":"bearer","operator":"=","value":"tbs"},{"field_key":"muc_tien","operator":"=","value":"lon"}]';
const C39 = '[{"field_key":"kho_xu_ly","operator":"=","value":"TBS Hà Nội"}]';
const C40 = '[{"field_key":"kho_xu_ly","operator":"=","value":"TBS HCM"}]';
const cond = (op: string, value: any, field = 'so_tien') => JSON.stringify([{ field_key: field, operator: op, value }]);

async function seedGroup12() {
  const t = await seedTemplate('adjustment_cost');
  const g = await seedBranchGroup(t.id);
  const mk = (id: number, branchName: string, priority: number, conditionJson: string, isDefault = false) =>
    prisma.approvalBranch.create({ data: { id, branchGroupId: g.id, branchName, priority, conditionJson, isDefault } });
  // chèn NGƯỢC thứ tự id để thứ tự lấy ra từ CSDL không vô tình trùng thứ tự priority
  await mk(30, 'TBS chịu — nhỏ (mặc định)', 4, '[]', true);
  await mk(29, 'TBS chịu — lớn (≥5tr)', 3, C29);
  await mk(28, 'Khách chịu — nhỏ', 2, C28);
  await mk(27, 'Khách chịu — lớn (≥5tr)', 1, C27);
  return t.id;
}
async function seedGroup16() {
  const t = await seedTemplate('phieu_xuat_kho');
  const g = await seedBranchGroup(t.id);
  const mk = (id: number, branchName: string, priority: number, conditionJson: string, isDefault = false) =>
    prisma.approvalBranch.create({ data: { id, branchGroupId: g.id, branchName, priority, conditionJson, isDefault } });
  await mk(41, 'Không xác định kho — giữ nguyên nhóm kho vận', 3, '[]', true);
  await mk(40, 'Kho TBS HCM', 2, C40);
  await mk(39, 'Kho TBS Hà Nội', 1, C39);
  return t.id;
}

describe('evaluate — định dạng mảng {field_key, operator, value} của prod', () => {
  test('nhánh 27 thật khớp bearer=customer VÀ muc_tien=lon', () => {
    expect(be.evaluate(C27, { bearer: 'customer', muc_tien: 'lon' })).toBe(true);
  });
  test('các điều kiện trong mảng là AND: sai muc_tien thì nhánh 27 không khớp', () => {
    expect(be.evaluate(C27, { bearer: 'customer', muc_tien: 'nho' })).toBe(false);
  });
  test('các điều kiện trong mảng là AND: sai bearer thì nhánh 27 không khớp', () => {
    expect(be.evaluate(C27, { bearer: 'tbs', muc_tien: 'lon' })).toBe(false);
  });
  test('mảng-của-mảng = OR các nhóm AND: khớp nhóm thứ hai', () => {
    const or = '[[{"field_key":"bearer","operator":"=","value":"customer"}],[{"field_key":"bearer","operator":"=","value":"tbs"}]]';
    expect(be.evaluate(or, { bearer: 'tbs' })).toBe(true);
  });
  test('mảng-của-mảng: không nhóm nào khớp ⇒ false', () => {
    const or = '[[{"field_key":"bearer","operator":"=","value":"customer"}],[{"field_key":"bearer","operator":"=","value":"tbs"}]]';
    expect(be.evaluate(or, { bearer: 'ncc' })).toBe(false);
  });
  test('điều kiện rỗng "[]" KHÔNG khớp (prod bỏ qua nhánh — chỉ is_default hứng)', () => {
    expect(be.evaluate('[]', { bearer: 'customer' })).toBe(false);
  });
  test('điều kiện NULL KHÔNG khớp', () => {
    expect(be.evaluate(null, {})).toBe(false);
  });
  test('định dạng đối tượng {field, op} (không có trên prod) KHÔNG khớp — fail-closed', () => {
    expect(be.evaluate('{"field":"so_tien","op":">=","value":1000}', { so_tien: 1500 })).toBe(false);
  });
  test("'=' so chuỗi phân biệt hoa thường: 'LON' ≠ 'lon'", () => {
    expect(be.evaluate(cond('=', 'lon', 'muc_tien'), { muc_tien: 'LON' })).toBe(false);
  });
  test("'=' giữa hai chuỗi số so theo GIÁ TRỊ như PHP ==: '5000000.0' = 5000000", () => {
    expect(be.evaluate(cond('=', '5000000.0'), { so_tien: 5000000 })).toBe(true);
  });
  test("'=' so chuỗi tiếng Việt đúng nguyên văn (nhánh 39 'TBS Hà Nội')", () => {
    expect(be.evaluate(C39, { kho_xu_ly: 'TBS Hà Nội' })).toBe(true);
  });
  test("toán tử lạ (vd '==') rơi về so sánh '=' như prod", () => {
    expect(be.evaluate(cond('==', 'lon', 'muc_tien'), { muc_tien: 'lon' })).toBe(true);
  });
  test("'!=' đúng khi khác", () => {
    expect(be.evaluate(cond('!=', 'customer', 'bearer'), { bearer: 'tbs' })).toBe(true);
  });
  test("'!=' sai khi bằng", () => {
    expect(be.evaluate(cond('!=', 'customer', 'bearer'), { bearer: 'customer' })).toBe(false);
  });
  test("'>=' đọc số kiểu VN: '5.000.000' >= 5000000", () => {
    expect(be.evaluate(cond('>=', '5000000'), { so_tien: '5.000.000' })).toBe(true);
  });
  test("'>=' đối chứng: '4.999.999' < 5000000", () => {
    expect(be.evaluate(cond('>=', '5000000'), { so_tien: '4.999.999' })).toBe(false);
  });
  test("'>' với phẩy thập phân VN: '5,5' > 5", () => {
    expect(be.evaluate(cond('>', '5'), { so_tien: '5,5' })).toBe(true);
  });
  test("'<' so số, không so chuỗi: 9 < 10", () => {
    expect(be.evaluate(cond('<', '10'), { so_tien: '9' })).toBe(true);
  });
  test("'<=' đúng khi bằng", () => {
    expect(be.evaluate(cond('<=', '1.000'), { so_tien: 1000 })).toBe(true);
  });
  test("'contains' không phân biệt hoa thường", () => {
    expect(be.evaluate(cond('contains', 'hà nội', 'kho_xu_ly'), { kho_xu_ly: 'Kho TBS HÀ NỘI' })).toBe(true);
  });
  test("'contains' đối chứng: không chứa ⇒ false", () => {
    expect(be.evaluate(cond('contains', 'hcm', 'kho_xu_ly'), { kho_xu_ly: 'TBS Hà Nội' })).toBe(false);
  });
  test('giá trị form là mảng thì nối bằng dấu phẩy rồi mới so (PHP implode)', () => {
    expect(be.evaluate(cond('=', 'a,b', 'tags'), { tags: ['a', 'b'] })).toBe(true);
  });
});

describe('resolveBranch — nhóm nhánh thật', () => {
  test('CỐT LÕI: khách chịu, muc_tien=lon ⇒ nhánh 27 "Khách chịu — lớn (≥5tr)"', async () => {
    const tid = await seedGroup12();
    expect(await be.resolveBranch(tid, { bearer: 'customer', muc_tien: 'lon', so_tien: 7000000 })).toBe(27);
  });
  test('ĐỐI CHỨNG: khách chịu, muc_tien=nho ⇒ nhánh 28 "Khách chịu — nhỏ"', async () => {
    const tid = await seedGroup12();
    expect(await be.resolveBranch(tid, { bearer: 'customer', muc_tien: 'nho', so_tien: 1000000 })).toBe(28);
  });
  test('TBS chịu, muc_tien=lon ⇒ nhánh 29 "TBS chịu — lớn (≥5tr)"', async () => {
    const tid = await seedGroup12();
    expect(await be.resolveBranch(tid, { bearer: 'tbs', muc_tien: 'lon' })).toBe(29);
  });
  test('TBS chịu, muc_tien=nho ⇒ nhánh mặc định 30', async () => {
    const tid = await seedGroup12();
    expect(await be.resolveBranch(tid, { bearer: 'tbs', muc_tien: 'nho' })).toBe(30);
  });
  test("phiếu xuất kho 'TBS HCM' ⇒ nhánh 40", async () => {
    const tid = await seedGroup16();
    expect(await be.resolveBranch(tid, { kho_xu_ly: 'TBS HCM' })).toBe(40);
  });
  test('phiếu xuất kho không rõ kho ⇒ nhánh mặc định 41', async () => {
    const tid = await seedGroup16();
    expect(await be.resolveBranch(tid, { kho_xu_ly: '' })).toBe(41);
  });
  test('priority TĂNG dần: hai nhánh cùng khớp ⇒ nhánh priority NHỎ hơn thắng', async () => {
    const t = await seedTemplate('prio'); const g = await seedBranchGroup(t.id);
    await seedBranch(g.id, { priority: 2, conditionJson: cond('=', 'customer', 'bearer') });
    const p1 = await seedBranch(g.id, { priority: 1, conditionJson: cond('=', 'lon', 'muc_tien') });
    expect(await be.resolveBranch(t.id, { bearer: 'customer', muc_tien: 'lon' })).toBe(p1.id);
  });
  test('nhánh is_default không dự thi dù điều kiện của nó khớp và priority nhỏ hơn', async () => {
    const t = await seedTemplate('defcond'); const g = await seedBranchGroup(t.id);
    await seedBranch(g.id, { priority: 0, conditionJson: cond('=', 'customer', 'bearer'), isDefault: true });
    const cand = await seedBranch(g.id, { priority: 5, conditionJson: cond('=', 'customer', 'bearer') });
    expect(await be.resolveBranch(t.id, { bearer: 'customer' })).toBe(cand.id);
  });
  test('không nhánh nào khớp và KHÔNG có nhánh mặc định ⇒ từ chối (prod trả lỗi, không rơi về luồng chính)', async () => {
    const t = await seedTemplate('nodef'); const g = await seedBranchGroup(t.id);
    await seedBranch(g.id, { priority: 1, conditionJson: C27 });
    await expect(be.resolveBranch(t.id, { bearer: 'tbs', muc_tien: 'nho' })).rejects.toThrow('nhánh mặc định');
  });
  test('no branch group -> null (main flow)', async () => {
    const t = await seedTemplate('y');
    expect(await be.resolveBranch(t.id, {})).toBeNull();
  });
});

test('evaluate: malformed/scalar conditions JSON resolves to false (fail-closed), does not throw', () => {
  expect(() => be.evaluate('null', { so_tien: 1 })).not.toThrow();
  expect(be.evaluate('null', { so_tien: 1 })).toBe(false);
  expect(() => be.evaluate('5', { so_tien: 1 })).not.toThrow();
  expect(be.evaluate('5', { so_tien: 1 })).toBe(false);
  expect(() => be.evaluate('"just a string"', { so_tien: 1 })).not.toThrow();
  expect(be.evaluate('"just a string"', { so_tien: 1 })).toBe(false);
});

test('evaluate: mảng chứa phần tử không phải điều kiện ⇒ false, không ném', () => {
  expect(be.evaluate('[5, "x", null]', { so_tien: 1 })).toBe(false);
});

test('resolveBranch: branch with scalar/malformed conditionJson falls back to default branch instead of throwing', async () => {
  const t = await seedTemplate('z'); const g = await seedBranchGroup(t.id);
  const bad = await seedBranch(g.id, { priority: 10, conditionJson: 'null' }); // scalar JSON -> không match, không throw
  const def = await seedBranch(g.id, { priority: 0, conditionJson: '', isDefault: true });
  await expect(be.resolveBranch(t.id, { so_tien: 200000000 })).resolves.toBe(def.id);
});
