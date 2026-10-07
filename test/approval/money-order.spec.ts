// I-1 (review cuối nhánh fix/03-money-gaps) — phiếu "đã duyệt" mà ví KHÔNG bị trừ.
//
// Mã cũ: runAutomation() commit status=APPROVED (⇒ tiền giữ của phiếu được NHẢ, vì HoldService chỉ
// giữ cho phiếu status=1) RỒI MỚI chạy onApproved() trừ ví ở một bước riêng. Một lệnh tiêu rơi đúng
// vào khe đó tiêu mất tiền đang chờ rút ⇒ bước trừ thất bại ⇒ phiếu vẫn APPROVED, synced=false,
// không ghi gì, không ai thử lại ⇒ KT chi tiền trên một ví đã bị tiêu. Sập tiến trình sau khi đánh
// synced=true ⇒ "đã duyệt, đã đồng bộ, chưa từng trừ" vĩnh viễn.
//
// Bất biến bộ này canh: phiếu có hiệu ứng tiền CHỈ thành APPROVED khi hiệu ứng đã nằm trong sổ,
// và hiệu ứng nằm trong sổ ĐÚNG MỘT LẦN — với MỌI handler tiền (rút ví lẫn phân bổ ví).
//
// Khách thử dùng tiền tố TBS_ZZAPPR_ (KHÔNG bắt đầu bằng ZZ): GL bỏ qua khách ZZ*, test đi qua GL
// mà dùng khách ZZ thì không kiểm gì.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { RequestService } from '../../src/approval/request.service';
import { ApprovalService } from '../../src/approval/approval.service';
import { BusinessSyncService } from '../../src/approval/business-sync.service';
import { WalletService, ApplyResult } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const RUT = 'TBS_ZZAPPR_rut_tien_vi_kh';
const PB = 'TBS_ZZAPPR_phan_bo_vi_kh';
const CUS = 'TBS_ZZAPPR_A';

let mod: TestingModule;
let reqSvc: RequestService;
let approvalSvc: ApprovalService;
let sync: BusinessSyncService;
let wallet: WalletService;
let hold: HoldService;
let origApply: WalletService['applyEntry'];

async function fresh() {
  jest.restoreAllMocks();
  await resetApproval();
  await resetDb();
  // gid 46 = KẾ TOÁN LOGISTICS trên prod (approver_ref của 'group' là gid cũ)
  await prisma.user.create({ data: { username: 'zzappr_kt', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'zzappr_kt2', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'zzappr_sale', password: 'x' } });
  for (const [code, objectType] of [[RUT, 'wallet_withdraw'], [PB, 'wallet_alloc']] as const) {
    const t = await seedTemplate(code, { objectType });
    const s = await seedStep(t.id, { order: 1 }); // MỘT bước OR ⇒ một người duyệt là xong
    await seedApprover(s.id, 'group', 46);
  }
}
const nap = (cus: string, amt: number) => origApply(cus, amt, 0, 'nạp thử', 'zzappr');
const submitRut = (amt: number) =>
  reqSvc.submit(RUT, 'wallet_withdraw', 0, 'RUT-' + CUS, 'zzappr_sale', { cus: CUS, so_tien: amt, chu_tk: 'A', so_tk_nhan: '1', ngan_hang: 'VCB' });
const submitPb = (amt: number) =>
  reqSvc.submit(PB, 'wallet_alloc', 0, 'PB-' + CUS, 'zzappr_sale', { cus: CUS, so_tien: amt });
const status = async (id: number) => (await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).status;
const countType = (type: number) => prisma.walletEntry.count({ where: { cusId: CUS, type } });
const failComments = (id: number) =>
  prisma.approvalComment.count({ where: { requestId: id, isSystem: true, comment: { startsWith: '[VI] TRU VI THAT BAI' } } });

/**
 * Chen MỘT lệnh tiêu vào đúng khoảnh khắc handler duyệt gọi applyEntry (nhận ra qua refKey
 * `approval:…`). Với mã cũ khoảnh khắc đó nằm SAU khi phiếu đã APPROVED (tiền giữ đã nhả).
 */
function interceptApprovalDebit(spend: () => Promise<ApplyResult>) {
  const box: { spend?: ApplyResult } = {};
  jest.spyOn(wallet, 'applyEntry').mockImplementation(async (...args: Parameters<WalletService['applyEntry']>) => {
    const refKey = String(args[6]?.refKey ?? '');
    if (!box.spend && refKey.startsWith('approval:')) box.spend = await spend();
    return origApply(...args);
  });
  return box;
}

const FLOOR_BEFORE = process.env.APPROVAL_SWEEP_CUTOVER_AT;
beforeAll(async () => {
  // Sàn cutover của lượt quét (bắt buộc — thiếu thì quét không chạy): 1 giờ trước, mọi phiếu bộ này
  // dựng đều "sau cutover". Ca sàn riêng nằm ở sweep-floor.spec.ts.
  process.env.APPROVAL_SWEEP_CUTOVER_AT = String(Math.floor(Date.now() / 1000) - 3600);
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init();
  reqSvc = mod.get(RequestService);
  approvalSvc = mod.get(ApprovalService);
  sync = mod.get(BusinessSyncService);
  wallet = mod.get(WalletService);
  hold = mod.get(HoldService);
  origApply = wallet.applyEntry.bind(wallet);
});
afterAll(async () => {
  if (FLOOR_BEFORE === undefined) delete process.env.APPROVAL_SWEEP_CUTOVER_AT;
  else process.env.APPROVAL_SWEEP_CUTOVER_AT = FLOOR_BEFORE;
  jest.restoreAllMocks();
  await resetApproval(); await resetDb();
  await mod.close();
  await prisma.$disconnect();
});

describe('RÚT — lệnh tiêu THƯỜNG chen đúng lúc trừ ví', () => {
  let box: { spend?: ApplyResult };
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    box = interceptApprovalDebit(() => origApply(CUS, -800_000, 1, 'thanh toán đơn', 'zzappr_sale'));
    await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
    jest.restoreAllMocks();
  });
  it('lệnh tiêu chen bị TỪ CHỐI (tiền của phiếu vẫn đang được giữ)', () => {
    expect(box.spend?.ok).toBe(false);
  });
  it('phiếu thành APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
  it('ví bị trừ rút ĐÚNG MỘT lần', async () => {
    expect(await countType(-3)).toBe(1);
  });
  it('số dư sổ = 1.000.000 − 300.000', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(700_000n);
  });
});

describe('RÚT — lệnh tiêu VƯỢT giữ (ignoreHold) chen ⇒ trừ ví thất bại', () => {
  let res: { ok: boolean; status: number; reason?: string };
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    interceptApprovalDebit(() => origApply(CUS, -800_000, 1, 'tiêu vượt giữ', 'zzappr_admin', 0, { ignoreHold: true }));
    res = await approvalSvc.approve(id, 'zzappr_kt').catch((e) => ({ ok: false, status: -99, reason: String(e) }));
    jest.restoreAllMocks();
  });
  it('phiếu KHÔNG thành APPROVED — vẫn chờ duyệt', async () => {
    expect(await status(id)).toBe(1);
  });
  it('không có bút toán rút nào', async () => {
    expect(await countType(-3)).toBe(0);
  });
  it('phiếu mang nhận xét hệ thống "[VI] TRU VI THAT BAI"', async () => {
    expect(await failComments(id)).toBe(1);
  });
  it('approve() báo KHÔNG hoàn tất', () => {
    expect(res.ok).toBe(false);
  });
  it('approve() trả trạng thái chờ duyệt (không ném)', () => {
    expect(res.status).toBe(1);
  });
  it('tiền của phiếu VẪN đang được giữ', async () => {
    expect(await hold.holdAmount(CUS)).toBe(300_000n);
  });
  it('synced vẫn false', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).synced).toBe(false);
  });
});

describe('RÚT — đối chứng: không ai chen', () => {
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    await approvalSvc.approve(id, 'zzappr_kt');
  });
  it('phiếu thành APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
  it('ví bị trừ rút ĐÚNG MỘT lần', async () => {
    expect(await countType(-3)).toBe(1);
  });
  it('số dư sổ = 700.000', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(700_000n);
  });
  it('synced = true', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).synced).toBe(true);
  });
  it('không có nhận xét thất bại', async () => {
    expect(await failComments(id)).toBe(0);
  });
});

describe('PHÂN BỔ — lệnh tiêu VƯỢT giữ chen ⇒ trừ ví thất bại', () => {
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitPb(300_000)).requestId;
    interceptApprovalDebit(() => origApply(CUS, -800_000, 1, 'tiêu vượt giữ', 'zzappr_admin', 0, { ignoreHold: true }));
    await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
    jest.restoreAllMocks();
  });
  it('phiếu KHÔNG thành APPROVED', async () => {
    expect(await status(id)).toBe(1);
  });
  it('không có bút toán phân bổ (type 4)', async () => {
    expect(await countType(4)).toBe(0);
  });
  it('phiếu mang nhận xét thất bại', async () => {
    expect(await failComments(id)).toBe(1);
  });
});

describe('PHÂN BỔ — đối chứng: không ai chen', () => {
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitPb(300_000)).requestId;
    await approvalSvc.approve(id, 'zzappr_kt');
  });
  it('phiếu thành APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
  it('đúng một bút toán phân bổ', async () => {
    expect(await countType(4)).toBe(1);
  });
});

describe('SẬP giữa chừng: trừ ví xong, tiến trình chết TRƯỚC khi đổi trạng thái', () => {
  let id: number;
  let afterCrashStatus: number;
  let afterCrashEntries: number;
  let rejectRes: { ok: boolean };
  let sweep1: Awaited<ReturnType<ApprovalService['resumeUnfinished']>>;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    const orig = sync.runEffect.bind(sync);
    jest.spyOn(sync, 'runEffect').mockImplementation(async (rid: number) => {
      await orig(rid);
      throw new Error('GIẢ LẬP SẬP TIẾN TRÌNH');
    });
    await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
    jest.restoreAllMocks();
    afterCrashStatus = await status(id);
    afterCrashEntries = await countType(-3);
    rejectRes = await approvalSvc.reject(id, 'zzappr_kt2', 'từ chối sau khi đã trừ');
    sweep1 = await approvalSvc.resumeUnfinished();
    await approvalSvc.resumeUnfinished(); // quét lần hai: không được trừ thêm
  });
  it('ngay sau sập: phiếu vẫn chờ duyệt', () => {
    expect(afterCrashStatus).toBe(1);
  });
  it('ngay sau sập: tiền đã trừ đúng một lần', () => {
    expect(afterCrashEntries).toBe(1);
  });
  it('TỪ CHỐI phiếu đã trừ ví bị chặn (không để "từ chối mà đã trừ")', () => {
    expect(rejectRes.ok).toBe(false);
  });
  it('quét lại: phiếu được hoàn tất', () => {
    expect(sweep1.finalized).toEqual([id]);
  });
  it('sau quét: phiếu APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
  it('sau hai lần quét: vẫn ĐÚNG MỘT bút toán rút', async () => {
    expect(await countType(-3)).toBe(1);
  });
  it('sau hai lần quét: số dư 700.000', async () => {
    expect(await wallet.getBalanceTrue(CUS)).toBe(700_000n);
  });
});

describe('SẬP giữa chừng — đối chứng: sập TRƯỚC khi trừ ⇒ quét KHÔNG tự duyệt', () => {
  let id: number;
  let sweep: Awaited<ReturnType<ApprovalService['resumeUnfinished']>>;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    jest.spyOn(sync, 'runEffect').mockRejectedValue(new Error('GIẢ LẬP SẬP TRƯỚC KHI TRỪ'));
    await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
    jest.restoreAllMocks();
    sweep = await approvalSvc.resumeUnfinished();
  });
  it('quét không hoàn tất phiếu chưa có hiệu ứng', () => {
    expect(sweep.finalized).toEqual([]);
  });
  it('phiếu vẫn chờ duyệt', async () => {
    expect(await status(id)).toBe(1);
  });
  it('chưa có bút toán nào', async () => {
    expect(await countType(-3)).toBe(0);
  });
  it('duyệt lại thì hoàn tất và trừ đúng một lần', async () => {
    await approvalSvc.approve(id, 'zzappr_kt');
    expect(await countType(-3)).toBe(1);
  });
});

describe('trạng thái CŨ: APPROVED + synced=false + chưa trừ (sản phẩm của mã cũ)', () => {
  let id: number;
  let sweep: Awaited<ReturnType<ApprovalService['resumeUnfinished']>>;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    const t = await prisma.approvalTemplate.findUniqueOrThrow({ where: { code: RUT } });
    id = (await prisma.approvalRequest.create({ data: {
      templateId: t.id, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2, finishedAt: Math.floor(Date.now() / 1000), // duyệt SAU sàn cutover (mã cũ của hệ mới)
      submittedBy: 'zzappr_sale', submittedAt: 1, formData: JSON.stringify({ cus: CUS, so_tien: 300_000 }),
    } })).id;
    sweep = await approvalSvc.resumeUnfinished();
    await approvalSvc.resumeUnfinished();
  });
  it('quét báo đã đồng bộ phiếu đó', () => {
    expect(sweep.synced).toEqual([id]);
  });
  it('trừ đúng một lần qua hai lần quét', async () => {
    expect(await countType(-3)).toBe(1);
  });
  it('synced = true', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).synced).toBe(true);
  });
});

describe('trạng thái CŨ — trừ thất bại khi quét ⇒ ghi dấu, không đánh synced', () => {
  let id: number;
  let sweep: Awaited<ReturnType<ApprovalService['resumeUnfinished']>>;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 100_000); // không đủ 300.000
    const t = await prisma.approvalTemplate.findUniqueOrThrow({ where: { code: RUT } });
    id = (await prisma.approvalRequest.create({ data: {
      templateId: t.id, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2, finishedAt: Math.floor(Date.now() / 1000), // duyệt SAU sàn cutover
      submittedBy: 'zzappr_sale', submittedAt: 1, formData: JSON.stringify({ cus: CUS, so_tien: 300_000 }),
    } })).id;
    sweep = await approvalSvc.resumeUnfinished();
    await approvalSvc.resumeUnfinished(); // lần hai: KHÔNG được đẻ thêm nhận xét trùng
  });
  it('quét báo thất bại đúng phiếu đó', () => {
    expect(sweep.failed.map((f) => f.id)).toEqual([id]);
  });
  it('synced vẫn false', async () => {
    expect((await prisma.approvalRequest.findUniqueOrThrow({ where: { id } })).synced).toBe(false);
  });
  it('đúng MỘT nhận xét thất bại dù quét hai lần (không spam)', async () => {
    expect(await failComments(id)).toBe(1);
  });
  it('không có bút toán rút', async () => {
    expect(await countType(-3)).toBe(0);
  });
});

describe('HAI người duyệt bước OR cuối CÙNG LÚC', () => {
  let id: number;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    await Promise.all([
      approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined),
      approvalSvc.approve(id, 'zzappr_kt2').catch(() => undefined),
    ]);
  });
  it('phiếu APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
  it('trừ đúng một lần', async () => {
    expect(await countType(-3)).toBe(1);
  });
});

/**
 * Chờ tới khi có một phiên CSDL đang ĐỢI KHOÁ trên câu `… tbl_approval_requests … FOR UPDATE` (tối đa
 * `ms`). Trả true nếu thấy. Dùng làm rào chắn TẤT ĐỊNH: thay vì cho lượt chen ngang "300 ms rồi mong
 * nó đã tới khoá", ta chờ tới khi Postgres xác nhận nó đang bị khoá dòng phiếu chặn lại.
 */
async function waitUntilBlockedOnRequestLock(ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const [r] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'
         AND query ILIKE '%tbl_approval_requests%FOR UPDATE%'`;
    if (r.n > 0) return true;
    await new Promise((res) => setTimeout(res, 25));
  }
  return false;
}

/**
 * Chạy `interloper(rid)` ĐÚNG lúc lượt duyệt cuối đang ở trong hiệu ứng (đang giữ khoá dòng phiếu, CHƯA
 * trừ ví), chờ cho tới khi lượt chen ngang bị khoá chặn, rồi mới cho trừ ví. Trả kết quả lượt chen ngang
 * và việc nó CÓ bị khoá chặn không. Mất khoá ⇒ lượt chen ngang không bao giờ bị chặn ⇒ `blocked=false`,
 * và nó chạy xong TRƯỚC khi trừ ví (`settledBeforeDebit=true`).
 */
async function interleaveDuringDebit(id: number, interloper: (rid: number) => Promise<{ ok: boolean }>) {
  const box = { blocked: false, settledBeforeDebit: false, res: undefined as { ok: boolean } | undefined };
  let pending: Promise<{ ok: boolean }> | undefined;
  const orig = sync.runEffect.bind(sync);
  jest.spyOn(sync, 'runEffect').mockImplementation(async (rid: number) => {
    let settled = false;
    pending = interloper(rid).then((r) => { settled = true; return r; });
    box.blocked = await waitUntilBlockedOnRequestLock(5000);
    box.settledBeforeDebit = settled;
    return orig(rid);
  });
  await approvalSvc.approve(id, 'zzappr_kt');
  jest.restoreAllMocks();
  box.res = await pending!;
  return box;
}

describe('TỪ CHỐI chen vào lúc đang trừ ví của lượt duyệt cuối', () => {
  let id: number;
  let box: Awaited<ReturnType<typeof interleaveDuringDebit>>;
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    box = await interleaveDuringDebit(id, (rid) => approvalSvc.reject(rid, 'zzappr_kt2', 'từ chối chen ngang'));
  }, 20_000);
  it('lượt từ chối THẬT SỰ bị khoá dòng phiếu chặn trong lúc trừ ví', () => {
    expect(box.blocked).toBe(true);
  });
  it('lượt từ chối chưa xong khi trừ ví bắt đầu', () => {
    expect(box.settledBeforeDebit).toBe(false);
  });
  it('lượt từ chối chen ngang bị từ chối', () => {
    expect(box.res!.ok).toBe(false);
  });
  it('phiếu APPROVED (không bị ghi đè thành REJECTED)', async () => {
    expect(await status(id)).toBe(2);
  });
  it('không lưu hành động reject mồ côi', async () => {
    expect(await prisma.approvalAction.count({ where: { requestId: id, action: 'reject' } })).toBe(0);
  });
  it('trừ đúng một lần', async () => {
    expect(await countType(-3)).toBe(1);
  });
});

describe('refKey khi hai lượt trừ CÙNG phiếu đua nhau trên số dư VỪA ĐỦ', () => {
  // Kiểm lời khẳng định "refKey làm chạy lại an toàn": applyEntry kiểm SỐ DƯ trước khi chạm UNIQUE,
  // nên bên thua cuộc đua thấy ví đã bị trừ và trả "Số dư ví không đủ" — KHÔNG phải alreadyApplied.
  // Handler phải tự nhận ra bút toán của chính phiếu đã nằm trong sổ.
  let results: PromiseSettledResult<void>[];
  beforeAll(async () => {
    await fresh();
    await nap(CUS, 300_000);
    const t = await prisma.approvalTemplate.findUniqueOrThrow({ where: { code: RUT } });
    const req = await prisma.approvalRequest.create({ data: {
      templateId: t.id, objectType: 'wallet_withdraw', objectId: 0, currentStepOrder: 1, status: 2,
      submittedBy: 'zzappr_sale', submittedAt: 1, formData: JSON.stringify({ cus: CUS, so_tien: 300_000 }),
    } });
    const h = (sync as any).handlers.get('wallet_withdraw');
    results = await Promise.allSettled([h.sync(req), h.sync(req)]);
  });
  it('cả hai lượt đều coi là thành công', () => {
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  });
  it('đúng một bút toán rút', async () => {
    expect(await countType(-3)).toBe(1);
  });
});

/** Giả lập sập: hiệu ứng (trừ ví) chạy xong rồi tiến trình chết TRƯỚC khi đổi trạng thái. */
async function crashAfterDebit(id: number) {
  const orig = sync.runEffect.bind(sync);
  jest.spyOn(sync, 'runEffect').mockImplementation(async (rid: number) => {
    await orig(rid);
    throw new Error('GIẢ LẬP SẬP TIẾN TRÌNH');
  });
  await approvalSvc.approve(id, 'zzappr_kt').catch(() => undefined);
  jest.restoreAllMocks();
}

/**
 * #04b Task 2 — bật "trả về" cho bước 1 của mẫu RUT. Prod đòi điểm duyệt có cấu hình trả về bật
 * (không có ⇒ 'Điểm duyệt này không bật trả về.'). Thiếu dòng này thì ca đối chứng dưới bị từ chối vì
 * CẤU HÌNH chứ không phải vì ví — và ca "sau sập bị chặn" có thể xanh vì lý do sai. Có dòng này, cả hai
 * ca mới đi tới đúng phép kiểm "đã trừ ví" (isApplied) mà chúng canh.
 */
async function enableReturnRut() {
  const t = await prisma.approvalTemplate.findUniqueOrThrow({ where: { code: RUT } });
  const step = await prisma.approvalStep.findFirstOrThrow({ where: { templateId: t.id, stepOrder: 1 } });
  await prisma.returnConfig.create({ data: { checkpointType: 'approval', checkpointRef: String(step.id), editMode: 'all' } });
}

describe('TRẢ VỀ người nộp sau sập (ví đã trừ) bị chặn', () => {
  let id: number;
  let res: { ok: boolean };
  beforeAll(async () => {
    await fresh();
    await enableReturnRut();
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    await crashAfterDebit(id);
    res = await approvalSvc.returnToSubmitter(id, 'zzappr_kt2', 'trả về sau khi đã trừ');
  });
  it('trả về bị từ chối', () => {
    expect(res.ok).toBe(false);
  });
  it('không lưu hành động return_submitter', async () => {
    expect(await prisma.approvalAction.count({ where: { requestId: id, action: 'return_submitter' } })).toBe(0);
  });
  it('đúng một bút toán rút', async () => {
    expect(await countType(-3)).toBe(1);
  });
});

describe('TRẢ VỀ người nộp — đối chứng: chưa trừ ví thì trả về được', () => {
  let res: { ok: boolean };
  beforeAll(async () => {
    await fresh();
    await enableReturnRut();
    await nap(CUS, 1_000_000);
    const id = (await submitRut(300_000)).requestId;
    res = await approvalSvc.returnToSubmitter(id, 'zzappr_kt2', 'thiếu chứng từ');
  });
  it('trả về thành công', () => {
    expect(res.ok).toBe(true);
  });
});

describe('THU HỒI sau sập (ví đã trừ) bị chặn', () => {
  let id: number;
  let res: { ok: boolean };
  beforeAll(async () => {
    await fresh();
    await prisma.approvalTemplate.update({ where: { code: RUT }, data: { allowRevokePending: true } });
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    await crashAfterDebit(id);
    res = await approvalSvc.revoke(id, 'zzappr_sale', 'thu hồi sau khi đã trừ');
  });
  it('thu hồi bị từ chối', () => {
    expect(res.ok).toBe(false);
  });
  it('phiếu vẫn chờ duyệt', async () => {
    expect(await status(id)).toBe(1);
  });
  it('không lưu hành động revoke', async () => {
    expect(await prisma.approvalAction.count({ where: { requestId: id, action: 'revoke' } })).toBe(0);
  });
});

describe('THU HỒI — đối chứng: chưa trừ ví thì thu hồi được', () => {
  let res: { ok: boolean };
  beforeAll(async () => {
    await fresh();
    await prisma.approvalTemplate.update({ where: { code: RUT }, data: { allowRevokePending: true } });
    await nap(CUS, 1_000_000);
    const id = (await submitRut(300_000)).requestId;
    res = await approvalSvc.revoke(id, 'zzappr_sale', 'nộp nhầm');
  });
  it('thu hồi thành công', () => {
    expect(res.ok).toBe(true);
  });
});

describe('THU HỒI chen vào lúc đang trừ ví của lượt duyệt cuối', () => {
  let id: number;
  let box: Awaited<ReturnType<typeof interleaveDuringDebit>>;
  beforeAll(async () => {
    await fresh();
    await prisma.approvalTemplate.update({ where: { code: RUT }, data: { allowRevokePending: true } });
    await nap(CUS, 1_000_000);
    id = (await submitRut(300_000)).requestId;
    box = await interleaveDuringDebit(id, (rid) => approvalSvc.revoke(rid, 'zzappr_sale', 'thu hồi chen ngang'));
  }, 20_000);
  it('lượt thu hồi THẬT SỰ bị khoá dòng phiếu chặn', () => {
    expect(box.blocked).toBe(true);
  });
  it('lượt thu hồi bị từ chối', () => {
    expect(box.res!.ok).toBe(false);
  });
  it('phiếu APPROVED', async () => {
    expect(await status(id)).toBe(2);
  });
});
