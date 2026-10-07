import { prisma, seedAccounts, resetDb } from '../helpers/db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { CatalogService } from '../../src/masterdata/catalog.service';

const cat = new CatalogService(prisma as any);

describe('CatalogService — ExpenseCategory gắn tài khoản GL', () => {
  beforeEach(async () => {
    await resetMasterdata();
    await resetDb();
    await seedAccounts();
  });
  afterAll(() => prisma.$disconnect());

  it('nhóm chưa gắn tài khoản GL KHÔNG nằm trong listPostable', async () => {
    await cat.upsertExpenseCategory({ code: 'CP01', name: 'Cước biển' }, 'admin'); // chưa gắn
    await cat.upsertExpenseCategory({ code: 'CP02', name: 'Phí cảng', glAccountCode: '635' }, 'admin');
    expect((await cat.listPostable()).map((e) => e.code)).toEqual(['CP02']);
  });

  it('đếm được số nhóm còn thiếu tài khoản (để dọn sau migrate)', async () => {
    await cat.upsertExpenseCategory({ code: 'CP03', name: 'A' }, 'admin');
    await cat.upsertExpenseCategory({ code: 'CP04', name: 'B' }, 'admin');
    expect(await cat.countMissingGlAccount()).toBe(2);
  });

  it('từ chối tài khoản GL không tồn tại trong sổ (#03)', async () => {
    await expect(
      cat.upsertExpenseCategory({ code: 'CP05', name: 'C', glAccountCode: '9999' }, 'admin'),
    ).rejects.toThrow();
  });

  it('đổi tên KHÔNG kèm glAccountCode -> GIỮ NGUYÊN mapping GL đã gắn (không âm thầm xoá)', async () => {
    await cat.upsertExpenseCategory({ code: 'CP02', name: 'Phí cảng', glAccountCode: '635' }, 'admin');
    await cat.upsertExpenseCategory({ code: 'CP02', name: 'Phí cảng (sửa)' }, 'admin');
    const updated = await prisma.expenseCategory.findFirst({ where: { code: 'CP02' } });
    expect(updated!.name).toBe('Phí cảng (sửa)');
    expect(updated!.glAccountCode).toBe('635');
    expect((await cat.listPostable()).map((e) => e.code)).toContain('CP02');
  });

  it('truyền glAccountCode RỖNG tường minh -> vẫn xoá được mapping (clear có chủ ý)', async () => {
    await cat.upsertExpenseCategory({ code: 'CP06', name: 'D', glAccountCode: '635' }, 'admin');
    await cat.upsertExpenseCategory({ code: 'CP06', name: 'D', glAccountCode: '' }, 'admin');
    const updated = await prisma.expenseCategory.findFirst({ where: { code: 'CP06' } });
    expect(updated!.glAccountCode).toBeNull();
  });

  it('listPostable bỏ qua nhóm CHI PHÍ đã tắt (status != "yes") dù có gắn GL', async () => {
    await cat.upsertExpenseCategory({ code: 'CP08', name: 'Còn bật, có GL', glAccountCode: '635' }, 'admin');
    await cat.upsertExpenseCategory({ code: 'CP09', name: 'Đã tắt, có GL', glAccountCode: '635' }, 'admin');
    // status là VARCHAR(3) hiện hành, giá trị bật = 'yes' — KHÔNG chuyển sang boolean.
    await prisma.expenseCategory.updateMany({ where: { code: 'CP09' }, data: { status: 'no' } });
    const codes = (await cat.listPostable()).map((e) => e.code);
    expect(codes).toContain('CP08');
    expect(codes).not.toContain('CP09');
  });

  it('2 dòng trùng code (rác migrate) -> upsert luôn chọn dòng id NHỎ NHẤT, xác định', async () => {
    // code KHÔNG có UNIQUE trong schema — prod thật có 6 cặp trùng kiểu này (junk slug
    // bị cắt varchar(100)). findFirst không orderBy để Postgres tự chọn theo THỨ TỰ VẬT LÝ
    // trong heap (seq scan), KHÔNG theo id — nên ở đây cố tình ghi id LỚN trước, id NHỎ sau
    // bằng SQL thô (chèn thẳng id, bỏ qua sequence) để thứ tự vật lý NGƯỢC thứ tự id: nếu
    // code thiếu orderBy, findFirst() sẽ nhặt đúng dòng id LỚN (chèn trước) — sai — không
    // phải nhặt đúng dòng bởi may mắn trùng thứ tự chèn như id tăng dần thông thường.
    await prisma.$executeRawUnsafe(
      `INSERT INTO tbl_chiphi_group (id, code, name) VALUES (9001, 'CP07', 'Bản rác (id lớn, chèn TRƯỚC)')`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO tbl_chiphi_group (id, code, name) VALUES (1, 'CP07', 'Bản cũ (id nhỏ, chèn SAU)')`,
    );

    await cat.upsertExpenseCategory({ code: 'CP07', name: 'X' }, 'admin');

    const rowLow = await prisma.expenseCategory.findUnique({ where: { id: 1 } });
    const rowHigh = await prisma.expenseCategory.findUnique({ where: { id: 9001 } });
    expect(rowLow!.name).toBe('X');                            // dòng id NHỎ HƠN được cập nhật
    expect(rowHigh!.name).toBe('Bản rác (id lớn, chèn TRƯỚC)'); // dòng kia giữ nguyên
    expect(await prisma.expenseCategory.count({ where: { code: 'CP07' } })).toBe(2); // không đẻ thêm bản
  });
});
