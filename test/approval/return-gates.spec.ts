// #04b Task 2 — "trả về cho người nộp sửa" nối vào ApprovalService: returnToSubmitter() viết lại (G5)
// + cổng G1–G4. Nguồn sự thật: docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §2.1–2.3, §8.1, §8.3.
//
// Lý do tồn tại của bộ này (§8.1): mã cũ "trả về" = kéo phiếu về bước đầu mà KHÔNG khoá gì — chữ ký
// cũ còn nguyên, lượt approve()/lượt quét kế tiếp tiến bước/finalize như thường. Nay phiếu ĐỨNG YÊN ở
// bước bị trả (không đổi currentStepOrder/pendingSince — khớp prod) và KHÔNG đường nào được tiến bước
// hay chạy hiệu ứng tiền khi dòng ReturnState còn `returned`:
//   G1 — đầu mỗi vòng lặp runAutomationDetailed() (điểm hợp lưu của approve() + lượt quét + mọi caller)
//   G2 — trong finalize() dưới khoá dòng phiếu, đọc bằng CÙNG tx (chống đua: trả về chen vào giữa G1
//        và lúc finalize lấy khoá)
//   G3 — approve() trả câu báo nguyên văn prod, không ghi hành động, KHÔNG miễn Super Admin
//   G4 — revoke() chặn người thường, Super Admin qua được
//
// Khách thử dùng tiền tố TBS_ZZTV_ (KHÔNG bắt đầu bằng ZZ): GL bỏ qua khách ZZ*.
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MoneyModule } from '../../src/money/money.module';
import { RequestService } from '../../src/approval/request.service';
import { ApprovalService } from '../../src/approval/approval.service';
import { ReturnService } from '../../src/approval/return.service';
import { WalletService } from '../../src/money/wallet.service';
import { HoldService } from '../../src/money/hold.service';
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const G3_MSG = 'Phiếu đang chờ người nộp sửa — không duyệt được.';
const G4_MSG = 'Phiếu đang bị trả về để sửa — hãy sửa và nộp lại, không thu hồi được.';
const OFF_MSG = 'Điểm duyệt này không bật trả về.';
const REASON_MSG = 'Phải ghi lý do trả về.';
const OT = 'approval_request';
const CUS = 'TBS_ZZTV_A';
const SWEEP_ENV = 'APPROVAL_SWEEP_CUTOVER_AT';
const savedSweepEnv = process.env[SWEEP_ENV];

let mod: TestingModule;
let reqSvc: RequestService;
let svc: ApprovalService;
let returns: ReturnService;
let wallet: WalletService;
let hold: HoldService;

type Tpl = { code: string; steps: { id: number; stepOrder: number; stepName: string | null }[] };

async function fresh() {
  jest.restoreAllMocks();
  await resetApproval();
  await resetDb();
  // approver_ref của 'group' là gid cũ trên prod: 46 = KẾ TOÁN LOGISTICS, 27 = Giám đốc.
  await prisma.user.create({ data: { username: 'zztv_kt', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'zztv_gd', password: 'x', gid: 27 } });
  await prisma.user.create({ data: { username: 'zztv_gd2', password: 'x', gid: 27 } });
  // Super Admin NẰM TRONG nhóm duyệt bước 2 ⇒ không có G3 thì SA duyệt được thật (ca SA có nghĩa).
  await prisma.user.create({ data: { username: 'zztv_sa', password: 'x', gid: 27, isSuperAdmin: true } });
  await prisma.user.create({ data: { username: 'zztv_sale', password: 'x' } });
  // Mẫu mồi: đẩy id bước lệch khỏi stepOrder ⇒ ca "checkpointRef = step.id, không phải stepOrder" có nghĩa.
  const decoy = await seedTemplate('ZZTV_decoy', { objectType: 'wallet_alloc' });
  for (const o of [1, 2, 3]) await seedStep(decoy.id, { order: o });
  await wallet.applyEntry(CUS, 1_000_000, 0, 'nạp thử', 'zztv');
}

/** Mẫu rút ví n bước: bước 1 nhóm 46, các bước sau nhóm 27. Có 2 trường form (cho fieldsOpened). */
async function mkTpl(code: string, n = 2, o: { allowRevokePending?: boolean } = {}): Promise<Tpl> {
  const t = await seedTemplate(code, { objectType: 'wallet_withdraw' });
  if (o.allowRevokePending) await prisma.approvalTemplate.update({ where: { id: t.id }, data: { allowRevokePending: true } });
  await prisma.approvalFormField.createMany({ data: [
    { templateId: t.id, fieldKey: 'cus', label: 'Khách', fieldType: 'text', sortOrder: 1 },
    { templateId: t.id, fieldKey: 'so_tien', label: 'Số tiền', fieldType: 'number', sortOrder: 2 },
  ] });
  const steps: Tpl['steps'] = [];
  for (let i = 1; i <= n; i++) {
    const s = await seedStep(t.id, { order: i, nodeType: 'OR' });
    await seedApprover(s.id, 'group', i === 1 ? 46 : 27);
    steps.push({ id: s.id, stepOrder: s.stepOrder, stepName: s.stepName });
  }
  return { code, steps };
}
const enableReturn = (stepId: number | string, o: { editMode?: 'off' | 'all' | 'whitelist'; requireReason?: boolean } = {}) =>
  prisma.returnConfig.create({ data: {
    checkpointType: 'approval', checkpointRef: String(stepId), editMode: o.editMode ?? 'all', requireReason: o.requireReason ?? true,
  } });
const submit = (t: Tpl, by = 'zztv_sale') =>
  reqSvc.submit(t.code, 'wallet_withdraw', 0, 'RUT-' + CUS, by,
    { cus: CUS, so_tien: 300_000, chu_tk: 'A', so_tk_nhan: '1', ngan_hang: 'VCB' });
const req = (id: number) => prisma.approvalRequest.findUniqueOrThrow({ where: { id } });
const withdrawals = () => prisma.walletEntry.count({ where: { cusId: CUS, type: -3 } });
/** Chữ ký bước ghi thẳng — giả lập lượt approve() của người khác đã ghi xong chữ ký TRƯỚC khi trả về
 *  lấy khoá (đua), hoặc dữ liệu nạp từ prod. */
const signAt = (requestId: number, stepOrder: number, by: string) =>
  prisma.approvalAction.create({ data: { requestId, stepOrder, action: 'approve', actedBy: by, actedAt: Math.floor(Date.now() / 1000) } });

/** Phiếu 2 bước: bước 1 đã duyệt, đang ở bước 2, bước 2 bật trả về. */
async function atStep2(n = 2) {
  const t = await mkTpl('ZZTV_rut_' + n + '_' + Math.random().toString(36).slice(2, 7), n);
  await enableReturn(t.steps[1].id);
  const { requestId } = await submit(t);
  const a = await svc.approve(requestId, 'zztv_kt');
  if (!a.ok || (await req(requestId)).currentStepOrder !== 2) throw new Error('fixture: bước 1 chưa duyệt xong — ' + JSON.stringify(a));
  return { t, requestId };
}

beforeAll(async () => {
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init(); // đăng ký handler nghiệp vụ (rút ví) — lượt quét cần handledTypes()
  reqSvc = mod.get(RequestService);
  svc = mod.get(ApprovalService);
  returns = mod.get(ReturnService);
  wallet = mod.get(WalletService);
  hold = mod.get(HoldService);
});
afterAll(async () => {
  if (savedSweepEnv === undefined) delete process.env[SWEEP_ENV]; else process.env[SWEEP_ENV] = savedSweepEnv;
  jest.restoreAllMocks();
  await resetApproval(); await resetDb();
  await mod.close();
  await prisma.$disconnect();
});
beforeEach(fresh);

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('G5 — returnToSubmitter() viết lại', () => {
  test('trả về ở bước 2: phiếu ĐỨNG YÊN (currentStepOrder + pendingSince không đổi), ReturnState returned, ghi hành động', async () => {
    const { t, requestId } = await atStep2();
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { pendingSince: 1_000 } }); // mốc dễ thấy
    const before = await req(requestId);

    const res = await svc.returnToSubmitter(requestId, 'zztv_gd', 'thiếu chứng từ');
    expect(res).toEqual({ ok: true, status: 1 });

    const after = await req(requestId);
    expect(after.status).toBe(1);
    expect(after.currentStepOrder).toBe(2);            // KHÔNG kéo về bước 1 (mã cũ làm vậy)
    expect(after.pendingSince).toBe(1_000);            // KHÔNG đặt lại đồng hồ (khớp prod §2.1)
    expect(after.formData).toBe(before.formData);

    const st = await returns.activeReturn(prisma as any, OT, requestId);
    expect(st).not.toBeNull();
    expect(st!.checkpointType).toBe('approval');
    expect(st!.checkpointRef).toBe(String(t.steps[1].id)); // id bước, KHÔNG phải stepOrder
    expect(t.steps[1].id).not.toBe(2);                     // (mẫu mồi đã làm lệch id ↔ stepOrder)
    expect(st!.reason).toBe('thiếu chứng từ');
    expect(st!.round).toBe(1);
    expect(st!.returnedBy).toBe('zztv_gd');
    expect(st!.fieldsOpened).toEqual(['cus', 'so_tien']);  // editMode 'all' ⇒ mọi trường của mẫu
    expect(st!.dataBefore).toEqual(JSON.parse(before.formData!));

    const acts = await prisma.approvalAction.findMany({ where: { requestId, action: 'return_submitter' } });
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({
      stepOrder: 2, stepName: t.steps[1].stepName, actedBy: 'zztv_gd', note: 'Trả người nộp sửa: thiếu chứng từ',
    });
  });

  test('không có dòng cấu hình ⇒ không trả được, không ghi gì', async () => {
    const t = await mkTpl('ZZTV_nocfg');
    const { requestId } = await submit(t);
    const res = await svc.returnToSubmitter(requestId, 'zztv_kt', 'x');
    expect(res).toMatchObject({ ok: false, reason: OFF_MSG });
    expect(await returns.state(OT, requestId)).toBeNull();
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'return_submitter' } })).toBe(0);
  });

  test("cấu hình editMode='off' ⇒ không trả được", async () => {
    const t = await mkTpl('ZZTV_off');
    await enableReturn(t.steps[0].id, { editMode: 'off' });
    const { requestId } = await submit(t);
    expect(await svc.returnToSubmitter(requestId, 'zztv_kt', 'x')).toMatchObject({ ok: false, reason: OFF_MSG });
    expect(await returns.state(OT, requestId)).toBeNull();
  });

  test('cấu hình theo stepOrder (không phải id bước) KHÔNG bật được trả về', async () => {
    const { t, requestId } = await (async () => {
      const t = await mkTpl('ZZTV_byorder');
      await enableReturn(1); // "1" = stepOrder của bước 1 — nhưng id bước 1 của mẫu này là 4
      return { t, ...(await submit(t)) };
    })();
    expect(t.steps[0].id).not.toBe(1);
    expect(await svc.returnToSubmitter(requestId, 'zztv_kt', 'x')).toMatchObject({ ok: false, reason: OFF_MSG });
  });

  test.each([['rỗng', ''], ['chỉ khoảng trắng', '   \t ']])('requireReason + lý do %s ⇒ lỗi, không ghi gì', async (_n, why) => {
    const t = await mkTpl('ZZTV_reason');
    await enableReturn(t.steps[0].id, { requireReason: true });
    const { requestId } = await submit(t);
    expect(await svc.returnToSubmitter(requestId, 'zztv_kt', why)).toMatchObject({ ok: false, reason: REASON_MSG });
    expect(await returns.state(OT, requestId)).toBeNull();
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'return_submitter' } })).toBe(0);
  });

  test('đối chứng: requireReason=false + lý do rỗng ⇒ trả được', async () => {
    const t = await mkTpl('ZZTV_noreason');
    await enableReturn(t.steps[0].id, { requireReason: false });
    const { requestId } = await submit(t);
    expect(await svc.returnToSubmitter(requestId, 'zztv_kt', '')).toEqual({ ok: true, status: 1 });
    expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
  });

  test('người không phải người duyệt bước hiện tại ⇒ không trả được', async () => {
    const { requestId } = await atStep2();
    expect((await svc.returnToSubmitter(requestId, 'zztv_kt', 'x')).ok).toBe(false); // kt là người duyệt BƯỚC 1
    expect(await returns.state(OT, requestId)).toBeNull();
  });

  test('trả lần nữa khi ĐANG bị trả ⇒ đi được, round+1 (prod không kiểm "đang bị trả rồi")', async () => {
    const { requestId } = await atStep2();
    expect((await svc.returnToSubmitter(requestId, 'zztv_gd', 'lần 1')).ok).toBe(true);
    expect((await svc.returnToSubmitter(requestId, 'zztv_gd2', 'lần 2')).ok).toBe(true);
    const st = await returns.activeReturn(prisma as any, OT, requestId);
    expect(st).toMatchObject({ round: 2, reason: 'lần 2', returnedBy: 'zztv_gd2' });
    expect((await req(requestId)).currentStepOrder).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('CA CỐT LÕI — 2 bước, bước 1 đã duyệt, bước 2 trả về ⇒ không đường nào duyệt xong', () => {
  test('(a) G3: approve() bởi người duyệt bước 2 bị từ chối bằng câu nguyên văn, không ghi chữ ký, ví không trừ', async () => {
    const { requestId } = await atStep2();
    expect((await svc.returnToSubmitter(requestId, 'zztv_gd', 'sai số tài khoản')).ok).toBe(true);

    const res = await svc.approve(requestId, 'zztv_gd');
    expect(res).toEqual({ ok: false, status: 1, reason: G3_MSG });
    expect(await prisma.approvalAction.count({ where: { requestId, stepOrder: 2, action: 'approve' } })).toBe(0);
    expect((await req(requestId)).status).toBe(1);
    expect(await withdrawals()).toBe(0);
  });

  test('(a) G3 KHÔNG miễn Super Admin — SA trong nhóm duyệt bước 2 cũng bị chặn', async () => {
    const { requestId } = await atStep2();
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    expect(await svc.approve(requestId, 'zztv_sa')).toEqual({ ok: false, status: 1, reason: G3_MSG });
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'approve', actedBy: 'zztv_sa' } })).toBe(0);
    expect(await withdrawals()).toBe(0);
  });

  test('(b) runAutomation() gọi thẳng, bước 2 ĐÃ có chữ ký (đua) ⇒ KHÔNG finalize, ví không trừ', async () => {
    const { requestId } = await atStep2();
    await signAt(requestId, 2, 'zztv_gd2'); // gd2 ghi chữ ký, rồi gd trả về
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');

    expect(await svc.runAutomation(requestId)).toBe(1);
    const r = await req(requestId);
    expect(r.status).toBe(1);
    expect(r.currentStepOrder).toBe(2);
    expect(await withdrawals()).toBe(0);
  });

  test('(b) lượt quét resumeUnfinished() ⇒ KHÔNG finalize phiếu bị trả (dù đủ điều kiện quét)', async () => {
    process.env[SWEEP_ENV] = String(Math.floor(Date.now() / 1000) - 3600);
    const { requestId } = await atStep2();
    await signAt(requestId, 2, 'zztv_gd2');
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    // Đưa phiếu vào diện (b) của lượt quét: bút toán neo refKey ĐÃ vào sổ (trạng thái giữa-sập / dữ liệu
    // nạp) — v2 không tự sinh được tổ hợp này (returnToSubmitter chặn khi isApplied, G2 chặn trừ ví khi
    // đang trả), nhưng lượt quét phải an toàn với MỌI dữ liệu, kể cả dữ liệu nạp.
    const d = await wallet.applyEntry(CUS, -300_000, -3, 'Rút tiền theo phiếu duyệt #' + requestId, 'zztv_sale', 0,
      { refKey: 'approval:' + requestId + ':wallet_withdraw', holdExcludeRequest: requestId });
    if (!d.ok) throw new Error('fixture: trừ ví thất bại — ' + d.msg);

    const sweep = await svc.resumeUnfinished();
    expect(sweep.ran).toBe(true);
    expect(sweep.finalized).not.toContain(requestId);
    expect(sweep.failed).toEqual([]);
    const r = await req(requestId);
    expect(r.status).toBe(1);
    expect(r.synced).toBe(false);
    expect(await withdrawals()).toBe(1); // chỉ bút toán fixture — không trừ thêm
  });

  test('đối chứng: SAU khi nộp lại (resubmitted) thì duyệt bình thường — cổng chỉ chặn state=returned', async () => {
    const { requestId } = await atStep2();
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    await returns.markResubmitted(prisma as any, OT, requestId, {});
    const res = await svc.approve(requestId, 'zztv_gd');
    expect(res).toEqual({ ok: true, status: 2 });
    expect(await withdrawals()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('G1 / G2 — mỗi cổng có một ca bắt riêng', () => {
  test('G1: phiếu 3 bước bị trả ở bước 2 (bước 2 đã có chữ ký) ⇒ runAutomation KHÔNG tiến sang bước 3', async () => {
    // Bước 2 không phải bước cuối ⇒ không tới finalize ⇒ G2 không che được — chỉ G1 chặn việc tiến bước.
    const { requestId } = await atStep2(3);
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { pendingSince: 1_000 } });
    await signAt(requestId, 2, 'zztv_gd2');
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');

    expect(await svc.runAutomation(requestId)).toBe(1);
    const r = await req(requestId);
    expect(r.currentStepOrder).toBe(2);
    expect(r.pendingSince).toBe(1_000);
  });

  test('M1: trả về chen vào GIỮA lúc G1 đã qua và lúc TIẾN BƯỚC (bước không phải cuối) ⇒ phiếu KHÔNG sang bước 3', async () => {
    // Review cuối #04b M1: tiến bước từng là `updateMany` ngoài khoá — trả về chen giữa G1 và lệnh đó thì
    // phiếu "đang bị trả" mà đã nhảy sang bước 3 (sai bước hiển thị + vết). Nay tiến bước dưới CÙNG khoá
    // dòng phiếu mà returnToSubmitter() lấy, và kiểm lại trạng thái trả về trong khoá.
    const { requestId } = await atStep2(3);
    const orig = (svc as any).advanceStep.bind(svc);
    let raced = false;
    jest.spyOn(svc as any, 'advanceStep').mockImplementationOnce(async (...args: any[]) => {
      const rr = await svc.returnToSubmitter(requestId, 'zztv_gd2', 'trả chen ngang');
      raced = rr.ok;
      return orig(...args);
    });

    const res = await svc.approve(requestId, 'zztv_gd');
    expect(raced).toBe(true);
    expect(res.status).toBe(1);
    expect((await req(requestId)).currentStepOrder).toBe(2);
    expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
  });

  test('G2: trả về chen vào GIỮA lúc G1 đã qua và finalize() lấy khoá ⇒ finalize không chạy hiệu ứng, không APPROVED', async () => {
    const { requestId } = await atStep2();
    // Chèn đúng khe đua: runAutomationDetailed() đã qua G1 và quyết định finalize; ngay trước khi finalize
    // lấy khoá dòng phiếu, một người duyệt khác trả phiếu về (returnToSubmitter tự lấy khoá + commit).
    const orig = (svc as any).finalize.bind(svc);
    let raced = false;
    jest.spyOn(svc as any, 'finalize').mockImplementationOnce(async (...args: any[]) => {
      const rr = await svc.returnToSubmitter(requestId, 'zztv_gd2', 'trả chen ngang');
      raced = rr.ok;
      return orig(...args);
    });

    const res = await svc.approve(requestId, 'zztv_gd');
    expect(raced).toBe(true);
    expect(res.status).toBe(1);
    const r = await req(requestId);
    expect(r.status).toBe(1);
    expect(r.synced).toBe(false);
    expect(await withdrawals()).toBe(0);
    expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Q1 — reject()/transfer() KHÔNG bị chặn khi đang bị trả (khớp prod, xem Q1)', () => {
  test('reject() vẫn từ chối được phiếu đang bị trả (khớp prod, xem Q1)', async () => {
    const { requestId } = await atStep2();
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    expect(await svc.reject(requestId, 'zztv_gd2', 'không làm nữa')).toEqual({ ok: true, status: -1 });
    expect((await req(requestId)).status).toBe(-1);
    // dòng trạng thái KHÔNG được dọn (prod không dọn) — ghi nhận, không sửa
    expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
  });

  test('transfer() vẫn chuyển được phiếu đang bị trả (khớp prod, xem Q1)', async () => {
    const { requestId } = await atStep2();
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    expect(await svc.transfer(requestId, 'zztv_gd', 'zztv_kt', 'nghỉ phép')).toEqual({ ok: true, status: 1 });
    expect(await prisma.approvalRequestApprover.count({ where: { requestId, username: 'zztv_kt', changeType: 'transfer_in' } })).toBe(1);
    // người được chuyển tới vẫn không DUYỆT được — G3
    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: false, status: 1, reason: G3_MSG });
  });
  // returnToStep(): v2 CHƯA có hàm này (grep src/ 0 kết quả) — khi dựng phải KHÔNG chặn (khớp prod, xem Q1).
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('G4 — revoke() khi đang bị trả', () => {
  test('người nộp thường KHÔNG thu hồi được, phiếu vẫn PENDING', async () => {
    const t = await mkTpl('ZZTV_rv', 2, { allowRevokePending: true });
    await enableReturn(t.steps[0].id);
    const { requestId } = await submit(t);
    await svc.returnToSubmitter(requestId, 'zztv_kt', 'x');
    expect(await svc.revoke(requestId, 'zztv_sale', 'thôi')).toEqual({ ok: false, status: 1, reason: G4_MSG });
    expect((await req(requestId)).status).toBe(1);
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'revoke' } })).toBe(0);
  });

  test('Super Admin (là người nộp) thu hồi ĐƯỢC phiếu đang bị trả', async () => {
    const t = await mkTpl('ZZTV_rvsa', 2, { allowRevokePending: true });
    await enableReturn(t.steps[0].id);
    const { requestId } = await submit(t, 'zztv_sa');
    expect((await svc.returnToSubmitter(requestId, 'zztv_kt', 'x')).ok).toBe(true);
    expect(await svc.revoke(requestId, 'zztv_sa', 'thôi')).toEqual({ ok: true, status: -2 });
    expect((await req(requestId)).status).toBe(-2);
  });

  test('đối chứng: người nộp thường thu hồi được khi phiếu KHÔNG bị trả', async () => {
    const t = await mkTpl('ZZTV_rvok', 2, { allowRevokePending: true });
    const { requestId } = await submit(t);
    expect(await svc.revoke(requestId, 'zztv_sale', 'thôi')).toEqual({ ok: true, status: -2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Giữ tiền ví — phiếu rút bị trả VẪN giữ tiền (khớp prod §2.3, đối chứng, không sửa)', () => {
  test('holdAmount = số tiền phiếu, khả dụng giảm tương ứng, sổ không đổi', async () => {
    const { requestId } = await atStep2();
    await svc.returnToSubmitter(requestId, 'zztv_gd', 'x');
    expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
    expect(await hold.holdAmount(CUS)).toBe(300_000n);
    expect(await wallet.getBalanceAvailable(CUS)).toBe(700_000n);
    expect(await wallet.getBalanceTrue(CUS)).toBe(1_000_000n);
  });
});
