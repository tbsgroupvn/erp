// Task 4 (24/09/2026) — sentinel `0` / `''` KHÔNG được lọt vào cột id NULL-able.
//
// `x ?? null` chỉ thay null/undefined — với x = 0 nó trả 0. applyEntry mặc định oid = 0 và
// chuyển thẳng xuống GL ⇒ mọi dòng GL của ví không gắn đơn mang order_id = 0, trong khi dữ liệu
// migrate (NULLIF) mang NULL ⇒ hai quy ước "không có đơn" cùng sống trong một cột.
// Mỗi ca đọc lại CỘT VẬT LÝ bằng SQL thô, kèm ca đối chứng id thật vẫn được lưu.
//
// ⚠ Ca đi qua applyEntry dùng mã khách 'TBS_ZZGL_*' chứ không 'ZZGL_*': postBiz CỐ Ý bỏ qua
// khách thử tiền tố ZZ (isTestCustomer) ⇒ không có dòng GL nào để kiểm, ca sẽ xanh suông.
import { prisma, resetDb, seedAccounts, seedMapping } from './helpers/db';
import { resetPo, seedPo } from './helpers/po-db';
import { resetMasterdata, seedCustomer } from './helpers/masterdata-db';
import { GlService } from '../src/money/gl.service';
import { GlMapService } from '../src/money/gl-map.service';
import { HoldService } from '../src/money/hold.service';
import { WalletService } from '../src/money/wallet.service';
import { PoReceiptService } from '../src/po/po-receipt.service';
import { PoStatus } from '../src/po/po.constants';

const gl = new GlService(prisma as any);
const glmap = new GlMapService(prisma as any, gl);
const wallet = new WalletService(prisma as any, new HoldService(prisma as any), glmap);
const receipts = new PoReceiptService(prisma as any);

beforeEach(async () => { await resetDb(); await seedAccounts(); await resetPo(); await resetMasterdata(); });
afterAll(() => prisma.$disconnect());

const glLineOrderIds = async (cus: string) =>
  (await prisma.$queryRawUnsafe<{ order_id: number | null }[]>(
    'SELECT order_id FROM tbl_gl_line WHERE cus_id = $1 ORDER BY id', cus)).map((r) => r.order_id);

describe('tbl_gl_line.order_id — đường thật applyEntry → postWallet → GlService.post', () => {
  it('nạp ví không gắn đơn (oid mặc định 0) ⇒ order_id NULL ở cả hai dòng GL', async () => {
    await seedMapping('wallet_nap', '111', '131');
    // đổi tên tác giả 25/09: postBiz nay bỏ qua dữ liệu thử theo createdBy zz*/reg như prod cls.glmap.php:55-66 — assertion giữ nguyên
    await wallet.applyEntry('TBS_ZZGL_1', 500_000, 0, 'ZZGL nạp', 'kt_gl_test');
    expect(await glLineOrderIds('TBS_ZZGL_1')).toEqual([null, null]);
  });

  it('đối chứng: nạp ví gắn đơn 42 ⇒ order_id = 42 ở cả hai dòng GL', async () => {
    await seedMapping('wallet_nap', '111', '131');
    // đổi tên tác giả 25/09: postBiz nay bỏ qua dữ liệu thử theo createdBy zz*/reg như prod cls.glmap.php:55-66 — assertion giữ nguyên
    await wallet.applyEntry('TBS_ZZGL_2', 500_000, 0, 'ZZGL nạp', 'kt_gl_test', 42);
    expect(await glLineOrderIds('TBS_ZZGL_2')).toEqual([42, 42]);
  });
});

const post = (sid: number, line: Record<string, unknown>, extra: Record<string, unknown> = {}) => gl.post({
  entryDate: 1, sourceType: 'ZZGL_thu', sourceId: sid, createdBy: 'ZZGL_t', ...extra,
  lines: [{ accountCode: '111', debit: 1000, credit: 0, ...line }, { accountCode: '131', debit: 0, credit: 1000, ...line }],
});
const lineCus = async (entryId: number) => (await prisma.$queryRawUnsafe<{ cus_id: string | null }[]>(
  'SELECT cus_id FROM tbl_gl_line WHERE entry_id = $1 ORDER BY id', entryId)).map((r) => r.cus_id);
const entryReversalOf = async (entryId: number) => (await prisma.$queryRawUnsafe<{ reversal_of: number | null }[]>(
  'SELECT reversal_of FROM tbl_gl_entry WHERE id = $1', entryId))[0].reversal_of;

describe('tbl_gl_line.cus_id — mã khách rỗng là "không gắn khách", phải NULL', () => {
  it("cusId '' ⇒ cus_id NULL", async () => {
    const r = await post(1, { cusId: '' });
    expect(await lineCus(r.entryId!)).toEqual([null, null]);
  });

  it("cusId chỉ có khoảng trắng ⇒ cus_id NULL", async () => {
    const r = await post(2, { cusId: '   ' });
    expect(await lineCus(r.entryId!)).toEqual([null, null]);
  });

  it('đối chứng: cusId thật được lưu nguyên', async () => {
    const r = await post(3, { cusId: 'ZZGL_KH9' });
    expect(await lineCus(r.entryId!)).toEqual(['ZZGL_KH9', 'ZZGL_KH9']);
  });
});

describe('tbl_gl_entry.reversal_of — "là bút toán đảo" ≡ reversal_of IS NOT NULL', () => {
  it('reversalOf 0 ⇒ reversal_of NULL (không thành "bút toán đảo của #0")', async () => {
    const r = await post(11, {}, { reversalOf: 0 });
    expect(await entryReversalOf(r.entryId!)).toBeNull();
  });

  it('đối chứng: reversalOf id thật được lưu', async () => {
    const goc = await post(12, {});
    const r = await post(13, {}, { reversalOf: goc.entryId });
    expect(await entryReversalOf(r.entryId!)).toBe(goc.entryId);
  });
});

describe('tbl_po_receipts — order_id / alloc_request_id', () => {
  async function addReceipt(code: string, extra: Record<string, unknown>) {
    const cus = await seedCustomer(code);
    const po = await seedPo(`ZZGL-PO-${code}`, { status: PoStatus.DA_DUYET, buyerId: cus.id, totalAmount: 10_000_000 });
    const r = await receipts.addReceipt(po.id, { customerId: code, amount: 100, method: 'bank', ...extra }, 'ZZGL_kt');
    if (!r.ok) throw new Error('addReceipt hỏng — ca sẽ đo sai chỗ: ' + r.msg);
    return (await prisma.$queryRawUnsafe<{ order_id: number | null; alloc_request_id: number | null; dot: number | null }[]>(
      'SELECT order_id, alloc_request_id, dot FROM tbl_po_receipts WHERE id = $1', r.receipt.id))[0];
  }

  it('orderId 0 ⇒ order_id NULL', async () => {
    expect((await addReceipt('ZZGL_RC1', { orderId: 0 })).order_id).toBeNull();
  });

  it('đối chứng: orderId 42 ⇒ order_id 42', async () => {
    expect((await addReceipt('ZZGL_RC2', { orderId: 42 })).order_id).toBe(42);
  });

  it('allocRequestId 0 ⇒ alloc_request_id NULL', async () => {
    expect((await addReceipt('ZZGL_RC3', { allocRequestId: 0 })).alloc_request_id).toBeNull();
  });

  it('đối chứng: allocRequestId 7 ⇒ alloc_request_id 7', async () => {
    expect((await addReceipt('ZZGL_RC4', { allocRequestId: 7 })).alloc_request_id).toBe(7);
  });

  // `dot` KHÔNG phải id: là số đợt thanh toán, prod NOT NULL DEFAULT 0 và 162/244 phiếu thật
  // mang dot = 0 ("không theo đợt"). Canh để không ai "chuẩn hoá" nhầm nó thành NULL.
  it('dot 0 được giữ nguyên là 0 (giá trị prod thật, không phải sentinel id)', async () => {
    expect((await addReceipt('ZZGL_RC5', { dot: 0 })).dot).toBe(0);
  });
});
