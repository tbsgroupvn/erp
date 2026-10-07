import { prisma, resetApproval, seedTemplate, seedBranchGroup } from '../helpers/approval-db';
import { BranchEvaluator } from '../../src/approval/branch-evaluator';
import { mucTien, applyMucTien, MUC_TIEN_TEMPLATES } from '../../src/approval/muc-tien';

/*
 * `muc_tien` — MÃ ĐỊNH TUYẾN duyệt ('lon'/'nho', so chuỗi PHÂN BIỆT hoa thường ở nhánh 27–29, 33–34, 37).
 * Prod tính PHÍA MÁY CHỦ trong ajaxs/adjustment/process_save.php (HEAD):
 *   $amount_vnd = floatval($a['amount_vnd']);            // $a = dòng tbl_adjustments vừa lưu
 *   $form['muc_tien'] = ($amount_vnd >= 5000000 ? 'lon' : 'nho');
 * cho kind cost/po_data/cogs_fix/order_cancel ⇒ mẫu adjustment_cost/_podata/_cogsfix/_ordercancel.
 */
const be = new BranchEvaluator(prisma as any);
beforeEach(resetApproval); afterAll(() => prisma.$disconnect());

describe('mucTien — ngưỡng 5.000.000đ', () => {
  test('4.999.999 ⇒ nho', () => { expect(mucTien(4_999_999)).toBe('nho'); });
  test('5.000.000 ⇒ lon (>=, không phải >)', () => { expect(mucTien(5_000_000)).toBe('lon'); });
  test('BigInt 5_000_000n ⇒ lon (VND của v2 là BigInt)', () => { expect(mucTien(5_000_000n)).toBe('lon'); });
  test('số âm ⇒ nho (prod floatval giữ dấu, không lấy trị tuyệt đối)', () => { expect(mucTien(-7_000_000)).toBe('nho'); });
  test('NaN ⇒ ném lỗi (không lặng lẽ định tuyến bằng số hỏng)', () => { expect(() => mucTien(Number.NaN)).toThrow(); });
});

describe('applyMucTien — GHI ĐÈ mọi giá trị phía client', () => {
  test("client gửi 'lon' cho khoản nhỏ ⇒ bị ghi đè thành 'nho'", () => {
    expect(applyMucTien({ bearer: 'customer', muc_tien: 'lon' }, 1_000_000).muc_tien).toBe('nho');
  });
  test("client gửi 'nho' cho khoản lớn ⇒ bị ghi đè thành 'lon'", () => {
    expect(applyMucTien({ bearer: 'customer', muc_tien: 'nho' }, 50_000_000).muc_tien).toBe('lon');
  });
  test("'LON' viết hoa không lọt qua: khoản lớn ⇒ đúng 'lon'", () => {
    expect(applyMucTien({ muc_tien: 'LON' }, 50_000_000).muc_tien).toBe('lon');
  });
  test("'LON' viết hoa cho khoản nhỏ ⇒ 'nho'", () => {
    expect(applyMucTien({ muc_tien: 'LON' }, 1_000).muc_tien).toBe('nho');
  });
  test('thiếu muc_tien ⇒ được điền', () => {
    expect(applyMucTien({ bearer: 'customer' }, 5_000_000).muc_tien).toBe('lon');
  });
  test('các trường khác giữ nguyên', () => {
    expect(applyMucTien({ bearer: 'customer', muc_tien: 'x' }, 1).bearer).toBe('customer');
  });
  test('không sửa đối tượng đầu vào (trả bản mới)', () => {
    const f = { muc_tien: 'lon' }; applyMucTien(f, 1);
    expect(f.muc_tien).toBe('lon');
  });
  test('danh sách mẫu định tuyến theo muc_tien đúng 4 mẫu của process_save.php', () => {
    expect([...MUC_TIEN_TEMPLATES].sort()).toEqual(['adjustment_cogsfix', 'adjustment_cost', 'adjustment_ordercancel', 'adjustment_podata']);
  });
});

test("đầu-cuối: khoản 50tr, client gửi 'nho' ⇒ qua applyMucTien vẫn vào nhánh 27 (khoản LỚN) của nhóm 12 thật", async () => {
  const t = await seedTemplate('adjustment_cost'); const g = await seedBranchGroup(t.id);
  const br = (id: number, priority: number, conditionJson: string, isDefault = false) =>
    prisma.approvalBranch.create({ data: { id, branchGroupId: g.id, priority, conditionJson, isDefault } });
  await br(27, 1, '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"lon"}]');
  await br(28, 2, '[{"field_key":"bearer","operator":"=","value":"customer"},{"field_key":"muc_tien","operator":"=","value":"nho"}]');
  await br(30, 4, '[]', true);
  expect(await be.resolveBranch(t.id, applyMucTien({ bearer: 'customer', muc_tien: 'nho', so_tien: 50_000_000 }, 50_000_000))).toBe(27);
});
