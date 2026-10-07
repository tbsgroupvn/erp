// Q8 (24/09/2026) — WalletEntry phải chở được tranId / trandetailId của prod.
//
// Prod tbl_wallet_detail: `tranId bigint(20) NULL` và `trandetailId bigint(20) NULL` (đo TỪNG cột
// qua information_schema, không suy cột này từ cột kia). 15.755/68.294 dòng có giá trị — liên kết
// DUY NHẤT từ bút toán ví về tbl_bank_transaction(_detail) (id bigint(20)). Bỏ cột khi migrate là
// mất liên kết đó vĩnh viễn. Đích: tran_id / trandetail_id BIGINT NULL.
//
// Giá trị thử > int4 (2.147.483.647) để chứng minh cột là BIGINT chứ không phải INT; hai cột nhận
// hai giá trị KHÁC nhau để lộ việc ghi nhầm cột này sang cột kia.
import { prisma, resetDb } from './helpers/db';

beforeEach(async () => { await resetDb(); });
afterAll(() => prisma.$disconnect());

const base = { type: 0, cusId: 'ZZGL_KH_TRAN', money: 1000n, cdate: 1 };

describe('WalletEntry.tranId (tbl_wallet_detail.tran_id)', () => {
  it('ghi rồi đọc lại đúng giá trị BIGINT vượt int4', async () => {
    const e = await prisma.walletEntry.create({ data: { ...base, tranId: 3_000_000_001n, trandetailId: 3_000_000_002n } });
    const back = await prisma.walletEntry.findUnique({ where: { id: e.id } });
    expect(back!.tranId).toBe(3_000_000_001n);
  });

  it('không truyền ⇒ NULL (dòng ví không đến từ ngân hàng)', async () => {
    const e = await prisma.walletEntry.create({ data: base });
    const back = await prisma.walletEntry.findUnique({ where: { id: e.id } });
    expect(back!.tranId).toBeNull();
  });
});

describe('WalletEntry.trandetailId (tbl_wallet_detail.trandetail_id)', () => {
  it('ghi rồi đọc lại đúng giá trị BIGINT vượt int4', async () => {
    const e = await prisma.walletEntry.create({ data: { ...base, tranId: 3_000_000_001n, trandetailId: 3_000_000_002n } });
    const back = await prisma.walletEntry.findUnique({ where: { id: e.id } });
    expect(back!.trandetailId).toBe(3_000_000_002n);
  });

  it('không truyền ⇒ NULL', async () => {
    const e = await prisma.walletEntry.create({ data: base });
    const back = await prisma.walletEntry.findUnique({ where: { id: e.id } });
    expect(back!.trandetailId).toBeNull();
  });

  it('dòng cũ có trandetailId = tranId được giữ nguyên, không bị "sửa" (3.299 dòng prod)', async () => {
    const e = await prisma.walletEntry.create({ data: { ...base, tranId: 1474n, trandetailId: 1474n } });
    const back = await prisma.walletEntry.findUnique({ where: { id: e.id } });
    expect(back!.trandetailId).toBe(1474n);
  });
});

// ETL nạp theo TÊN CỘT vật lý — round-trip qua Prisma mù với việc hai @map bị tráo cho nhau.
describe('field Prisma rơi đúng cột vật lý', () => {
  const raw = async (id: bigint) => (await prisma.$queryRawUnsafe<{ tran_id: bigint | null; trandetail_id: bigint | null }[]>(
    'SELECT tran_id, trandetail_id FROM tbl_wallet_detail WHERE id = $1', id))[0];

  it('tranId nằm ở cột tran_id', async () => {
    const e = await prisma.walletEntry.create({ data: { ...base, tranId: 3_000_000_001n, trandetailId: 3_000_000_002n } });
    expect((await raw(e.id)).tran_id).toBe(3_000_000_001n);
  });

  it('trandetailId nằm ở cột trandetail_id', async () => {
    const e = await prisma.walletEntry.create({ data: { ...base, tranId: 3_000_000_001n, trandetailId: 3_000_000_002n } });
    expect((await raw(e.id)).trandetail_id).toBe(3_000_000_002n);
  });
});

describe('schema đích khớp kiểu prod (information_schema)', () => {
  const col = (name: string) => prisma.$queryRawUnsafe<{ data_type: string; is_nullable: string }[]>(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'tbl_wallet_detail' AND column_name = $1`, name);

  it('tran_id là bigint NULL', async () => {
    expect(await col('tran_id')).toEqual([{ data_type: 'bigint', is_nullable: 'YES' }]);
  });

  it('trandetail_id là bigint NULL', async () => {
    expect(await col('trandetail_id')).toEqual([{ data_type: 'bigint', is_nullable: 'YES' }]);
  });
});
