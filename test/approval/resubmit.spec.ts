// #04b Task 3 — ApprovalService.resubmit() (G6): cửa DUY NHẤT để người nộp gửi lại phiếu sau khi sửa.
// Nguồn sự thật: docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md §2.2 T3, §2.4, §4, §8.3 G6.
//
// Điều cốt lõi phải giữ (§2.4 bước 3): nộp lại HUỶ MỌI chữ ký approve/auto_approve cũ và đưa phiếu về
// bước 1 ⇒ duyệt lại TỪ ĐẦU. Không huỷ thì chữ ký cũ của bước 1 vẫn "đủ", và lượt runAutomation kế
// tiếp (lượt quét, hay bất kỳ approve() nào) tự đẩy phiếu qua bước 1 mà không ai xem lại bản đã sửa.
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
import { prisma, resetApproval, seedTemplate, seedStep, seedApprover } from '../helpers/approval-db';
import { resetDb } from '../helpers/db';

const NOT_RETURNED_MSG = 'Phiếu này không ở trạng thái chờ sửa.';
const NOT_SUBMITTER_MSG = 'Chỉ người nộp phiếu mới nộp lại được.';
const OT = 'approval_request';
const CUS = 'TBS_ZZTV_R';

let mod: TestingModule;
let reqSvc: RequestService;
let svc: ApprovalService;
let returns: ReturnService;
let wallet: WalletService;

type Tpl = { code: string; templateId: number; steps: { id: number; stepOrder: number; stepName: string | null }[] };

async function fresh() {
  jest.restoreAllMocks();
  await resetApproval();
  await resetDb();
  // approver_ref của 'group' là gid cũ trên prod: 46 = KẾ TOÁN LOGISTICS, 27 = Giám đốc.
  await prisma.user.create({ data: { username: 'zztv_kt', password: 'x', gid: 46 } });
  await prisma.user.create({ data: { username: 'zztv_gd', password: 'x', gid: 27 } });
  await prisma.user.create({ data: { username: 'zztv_gd2', password: 'x', gid: 27 } });
  await prisma.user.create({ data: { username: 'zztv_sa', password: 'x', gid: 27, isSuperAdmin: true } });
  await prisma.user.create({ data: { username: 'zztv_sale', password: 'x' } });
  // Mẫu mồi: đẩy id bước lệch khỏi stepOrder (checkpointRef = id bước).
  const decoy = await seedTemplate('ZZTV_decoy', { objectType: 'wallet_alloc' });
  for (const o of [1, 2, 3]) await seedStep(decoy.id, { order: o });
  await wallet.applyEntry(CUS, 1_000_000, 0, 'nạp thử', 'zztv');
}

/** Mẫu rút ví n bước: bước 1 nhóm 46, các bước sau nhóm 27. Danh mục trường: cus, so_tien, ghi_chu. */
async function mkTpl(n = 2, o: { allowRevokePending?: boolean } = {}): Promise<Tpl> {
  const code = 'ZZTV_rs_' + Math.random().toString(36).slice(2, 8);
  const t = await seedTemplate(code, { objectType: 'wallet_withdraw' });
  if (o.allowRevokePending) await prisma.approvalTemplate.update({ where: { id: t.id }, data: { allowRevokePending: true } });
  await prisma.approvalFormField.createMany({ data: [
    { templateId: t.id, fieldKey: 'cus', label: 'Khách', fieldType: 'text', sortOrder: 1 },
    { templateId: t.id, fieldKey: 'so_tien', label: 'Số tiền', fieldType: 'number', sortOrder: 2 },
    { templateId: t.id, fieldKey: 'ghi_chu', label: 'Ghi chú', fieldType: 'text', sortOrder: 3 },
  ] });
  const steps: Tpl['steps'] = [];
  for (let i = 1; i <= n; i++) {
    const s = await seedStep(t.id, { order: i, nodeType: 'OR' });
    await seedApprover(s.id, 'group', i === 1 ? 46 : 27);
    steps.push({ id: s.id, stepOrder: s.stepOrder, stepName: s.stepName });
  }
  return { code, templateId: t.id, steps };
}
async function enableReturn(stepId: number, o: { editMode?: 'all' | 'whitelist'; fields?: string[] } = {}) {
  const c = await prisma.returnConfig.create({ data: {
    checkpointType: 'approval', checkpointRef: String(stepId), editMode: o.editMode ?? 'all', requireReason: true,
  } });
  if (o.fields?.length) await prisma.returnConfigField.createMany({ data: o.fields.map((fieldKey) => ({ configId: c.id, fieldKey })) });
  return c;
}
const submit = (t: Tpl, by = 'zztv_sale') =>
  reqSvc.submit(t.code, 'wallet_withdraw', 0, 'RUT-' + CUS, by,
    { cus: CUS, so_tien: 300_000, ghi_chu: 'ban đầu', chu_tk: 'A', so_tk_nhan: '1', ngan_hang: 'VCB' });
const req = (id: number) => prisma.approvalRequest.findUniqueOrThrow({ where: { id } });
const form = async (id: number) => JSON.parse((await req(id)).formData!);
const withdrawals = () => prisma.walletEntry.count({ where: { cusId: CUS, type: -3 } });
const liveSigs = (requestId: number) =>
  prisma.approvalAction.count({ where: { requestId, action: { in: ['approve', 'auto_approve'] }, voided: false } });
const signAt = (requestId: number, stepOrder: number, by: string) =>
  prisma.approvalAction.create({ data: { requestId, stepOrder, action: 'approve', actedBy: by, actedAt: Math.floor(Date.now() / 1000) } });

/** Phiếu 2 bước (hoặc n): bước 1 đã duyệt (kt), đang ở bước 2, bước 2 bật trả về, rồi gd TRẢ VỀ. */
async function returnedAtStep2(o: { n?: number; editMode?: 'all' | 'whitelist'; fields?: string[]; allowRevokePending?: boolean } = {}) {
  const t = await mkTpl(o.n ?? 2, { allowRevokePending: o.allowRevokePending });
  await enableReturn(t.steps[1].id, { editMode: o.editMode, fields: o.fields });
  const { requestId } = await submit(t);
  const a = await svc.approve(requestId, 'zztv_kt');
  if (!a.ok || (await req(requestId)).currentStepOrder !== 2) throw new Error('fixture: bước 1 chưa duyệt xong — ' + JSON.stringify(a));
  const r = await svc.returnToSubmitter(requestId, 'zztv_gd', 'sai số tiền');
  if (!r.ok) throw new Error('fixture: trả về thất bại — ' + JSON.stringify(r));
  return { t, requestId };
}

beforeAll(async () => {
  mod = await Test.createTestingModule({ imports: [PrismaModule, ApprovalModule, MoneyModule] }).compile();
  await mod.init(); // đăng ký handler rút ví
  reqSvc = mod.get(RequestService);
  svc = mod.get(ApprovalService);
  returns = mod.get(ReturnService);
  wallet = mod.get(WalletService);
});
afterAll(async () => {
  jest.restoreAllMocks();
  await resetApproval(); await resetDb();
  await mod.close();
  await prisma.$disconnect();
});
beforeEach(fresh);

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(1) CA CỐT LÕI — nộp lại huỷ chữ ký cũ, duyệt lại TỪ bước 1', () => {
  test('bước 1 đã duyệt, bước 2 trả về, nộp lại ⇒ về bước 1, chữ ký cũ voided, runAutomation KHÔNG tự tiến', async () => {
    // Chứng minh: chữ ký cũ không còn hiệu lực. Nếu resubmit() quên huỷ chữ ký, chữ ký bước 1 của kt
    // vẫn "đủ" ⇒ runAutomation (lượt quét / approve bất kỳ) đẩy phiếu sang bước 2 ngay, không ai xem
    // lại bản đã sửa. Chữ ký bước 2 (gd2 ký trước khi gd trả về) cũng phải bị huỷ — nếu không, sau khi
    // kt duyệt lại bước 1 phiếu sẽ xuyên luôn bước 2 và finalize (trừ ví) mà bước 2 chưa ai duyệt lại.
    const { requestId } = await (async () => {
      const t = await mkTpl(2);
      await enableReturn(t.steps[1].id);
      const { requestId } = await submit(t);
      expect((await svc.approve(requestId, 'zztv_kt')).ok).toBe(true);
      await signAt(requestId, 2, 'zztv_gd2'); // gd2 đã ký bước 2 …
      expect((await svc.returnToSubmitter(requestId, 'zztv_gd', 'sai số tiền')).ok).toBe(true); // … rồi gd trả về
      return { requestId };
    })();
    expect(await liveSigs(requestId)).toBe(2);
    const t0 = Math.floor(Date.now() / 1000);

    const res = await svc.resubmit(requestId, 'zztv_sale', { so_tien: 250_000 });
    expect(res).toMatchObject({ ok: true });

    const r = await req(requestId);
    expect(r.currentStepOrder).toBe(1);          // hằng số 1 (Q2)
    expect(r.noAutoDedup).toBe(true);
    expect(r.pendingSince).toBeGreaterThanOrEqual(t0);
    expect(r.status).toBe(1);
    expect(await liveSigs(requestId)).toBe(0);   // MỌI chữ ký cũ bị huỷ
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'approve', voided: true } })).toBe(2);

    // Hành động resubmit ghi đúng nguyên văn prod.
    const act = await prisma.approvalAction.findMany({ where: { requestId, action: 'resubmit' } });
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ stepOrder: 1, stepName: 'Nộp lại', actedBy: 'zztv_sale', note: 'Nộp lại sau khi sửa (1 trường đổi)' });

    // Không tự tiến nhờ chữ ký cũ.
    expect(await svc.runAutomation(requestId)).toBe(1);
    expect((await req(requestId)).currentStepOrder).toBe(1);
    // Người duyệt bước 2 không duyệt được lúc phiếu đang ở bước 1.
    expect((await svc.approve(requestId, 'zztv_gd')).ok).toBe(false);

    // Phải duyệt lại bước 1 …
    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: true, status: 1 });
    // … và dừng ở bước 2 (chữ ký cũ của gd2 ở bước 2 đã huỷ) — chưa trừ ví.
    expect((await req(requestId)).currentStepOrder).toBe(2);
    expect(await withdrawals()).toBe(0);
  });

  test('ReturnState chuyển sang resubmitted, dataAfter = formData đã hợp nhất; KHÔNG chạy runAutomation', async () => {
    // Chứng minh: markResubmitted nhận đúng bản hợp nhất, và resubmit() không tự chạy luật vào bước (Q3):
    // bước 1 mẫu này auto_approve — nếu resubmit gọi runAutomation thì phiếu đã tự nhảy sang bước 2.
    const t = await mkTpl(2);
    await prisma.approvalStep.update({ where: { id: t.steps[0].id }, data: { approvalMode: 'auto_approve' } });
    await enableReturn(t.steps[1].id);
    const { requestId } = await submit(t);
    expect(await svc.runAutomation(requestId)).toBe(1); // bước 1 auto ⇒ tiến sang bước 2
    expect((await req(requestId)).currentStepOrder).toBe(2);
    expect((await svc.returnToSubmitter(requestId, 'zztv_gd', 'x')).ok).toBe(true);

    expect((await svc.resubmit(requestId, 'zztv_sale', { ghi_chu: 'đã sửa' })).ok).toBe(true);
    expect((await req(requestId)).currentStepOrder).toBe(1); // không runAutomation
    const st = await returns.state(OT, requestId);
    expect(st).toMatchObject({ state: 'resubmitted', round: 1 });
    expect(st!.resubmittedAt).toBeGreaterThan(0);
    expect(st!.dataAfter).toEqual(await form(requestId));
    expect((st!.dataAfter as any).ghi_chu).toBe('đã sửa');
    expect(returns.changedFields(st)).toEqual({ ghi_chu: { cu: 'ban đầu', moi: 'đã sửa' } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(2) hợp nhất theo whitelist của cấu hình HIỆN TẠI', () => {
  test('__selfSelected KHÔNG sửa được qua nộp lại, kể cả khi mở TẤT CẢ trường (editMode=all)', async () => {
    // Chứng minh: `__selfSelected` quyết định chặn tự duyệt (approval.service.ts — đọc từ formData).
    // Nó không phải trường của mẫu ⇒ không bao giờ nằm trong danh mục ⇒ cửa nộp lại không được cho
    // người nộp tự ghi đè nó (gửi lên thì giữ nguyên giá trị cũ; chưa có thì rơi mất).
    const { requestId } = await returnedAtStep2({ editMode: 'all' });
    const r0 = await req(requestId);
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { formData: JSON.stringify({ ...JSON.parse(r0.formData!), __selfSelected: ['zztv_gd'] }) },
    });
    const res = await svc.resubmit(requestId, 'zztv_sale', { ghi_chu: 'sửa', __selfSelected: ['zztv_sale'] });
    expect(res).toMatchObject({ ok: true });
    const after = await form(requestId);
    expect(after.__selfSelected).toEqual(['zztv_gd']); // giữ nguyên, không bị người nộp đổi
    expect(after.ghi_chu).toBe('sửa');                 // đối chứng: trường thật của mẫu vẫn sửa được
  });

  test('trường ngoài whitelist giữ giá trị cũ, trường trong whitelist đổi; khoá lạ rơi mất', async () => {
    // Chứng minh: resubmit không phải cửa hậu sửa mọi trường — chỉ trường được mở mới đổi.
    const { requestId } = await returnedAtStep2({ editMode: 'whitelist', fields: ['so_tien'] });
    const before = await form(requestId);

    const res = await svc.resubmit(requestId, 'zztv_sale', { so_tien: 200_000, cus: 'TBS_ZZTV_KHAC', la: 'x' });
    expect(res).toMatchObject({ ok: true });
    const after = await form(requestId);
    expect(after.so_tien).toBe(200_000);        // trong whitelist ⇒ đổi
    expect(after.cus).toBe(CUS);                // ngoài whitelist ⇒ giữ nguyên
    expect(after).not.toHaveProperty('la');     // khoá mới không được phép ⇒ rơi mất
    expect({ ...after, so_tien: before.so_tien }).toEqual(before); // ngoài so_tien không gì đổi
    // N chỉ đếm trường thực sự đổi được (không đếm trường bị chặn)
    const act = await prisma.approvalAction.findFirstOrThrow({ where: { requestId, action: 'resubmit' } });
    expect(act.note).toBe('Nộp lại sau khi sửa (1 trường đổi)');
  });

  test('dùng cấu hình HIỆN TẠI, không phải ảnh chụp fieldsOpened lúc trả', async () => {
    // Chứng minh: whitelist đổi giữa lúc trả và lúc nộp ⇒ backend theo cấu hình mới (prod §2.4 bước 1).
    const { t, requestId } = await returnedAtStep2({ editMode: 'whitelist', fields: ['so_tien'] });
    expect((await returns.state(OT, requestId))!.fieldsOpened).toEqual(['so_tien']);
    const cfg = await prisma.returnConfig.findFirstOrThrow({ where: { checkpointRef: String(t.steps[1].id) } });
    await prisma.returnConfigField.deleteMany({ where: { configId: cfg.id } });
    await prisma.returnConfigField.create({ data: { configId: cfg.id, fieldKey: 'ghi_chu' } });

    await svc.resubmit(requestId, 'zztv_sale', { so_tien: 1, ghi_chu: 'mới' });
    const after = await form(requestId);
    expect(after.so_tien).toBe(300_000); // ảnh chụp mở so_tien nhưng cấu hình hiện tại thì không
    expect(after.ghi_chu).toBe('mới');
  });

  test('không gửi trường nào đổi ⇒ note không có hậu tố "(N trường đổi)"', async () => {
    const { requestId } = await returnedAtStep2();
    expect((await svc.resubmit(requestId, 'zztv_sale', { so_tien: 300_000 })).ok).toBe(true);
    const act = await prisma.approvalAction.findFirstOrThrow({ where: { requestId, action: 'resubmit' } });
    expect(act.note).toBe('Nộp lại sau khi sửa');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(3) chỉ người nộp — không miễn Super Admin', () => {
  test.each([['người duyệt khác', 'zztv_kt'], ['Super Admin', 'zztv_sa'], ['chính người trả về', 'zztv_gd']])(
    '%s không nộp lại được, không ghi gì', async (_n, actor) => {
      // Chứng minh: cửa nộp lại khoá theo submittedBy (prod T3), không có nhánh admin.
      const { requestId } = await returnedAtStep2();
      const before = await req(requestId);
      const res = await svc.resubmit(requestId, actor, { so_tien: 1 });
      expect(res).toMatchObject({ ok: false, reason: NOT_SUBMITTER_MSG });
      const after = await req(requestId);
      expect(after).toEqual(before);
      expect(await returns.activeReturn(prisma as any, OT, requestId)).not.toBeNull();
      expect(await prisma.approvalAction.count({ where: { requestId, action: 'resubmit' } })).toBe(0);
      expect(await liveSigs(requestId)).toBe(1); // chữ ký bước 1 còn nguyên
    });

  test('người nộp-hộ (submittedOnBehalfBy) không được tính là người nộp', async () => {
    const { requestId } = await returnedAtStep2();
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { submittedOnBehalfBy: 'zztv_kt' } });
    expect(await svc.resubmit(requestId, 'zztv_kt', {})).toMatchObject({ ok: false, reason: NOT_SUBMITTER_MSG });
  });

  test('submittedBy có khoảng trắng thừa vẫn khớp (prod trim(submitted_by))', async () => {
    const { requestId } = await returnedAtStep2();
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { submittedBy: ' zztv_sale ' } });
    expect((await svc.resubmit(requestId, 'zztv_sale', {})).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(4) không ở trạng thái chờ sửa ⇒ lỗi', () => {
  test('phiếu chưa từng bị trả ⇒ lỗi, không đổi gì', async () => {
    // Chứng minh: resubmit không phải đường tắt để "reset" phiếu về bước 1 / huỷ chữ ký.
    const t = await mkTpl(2);
    const { requestId } = await submit(t);
    await svc.approve(requestId, 'zztv_kt');
    const before = await req(requestId);
    expect(await svc.resubmit(requestId, 'zztv_sale', { so_tien: 1 })).toMatchObject({ ok: false, reason: NOT_RETURNED_MSG });
    expect(await req(requestId)).toEqual(before);
    expect(await liveSigs(requestId)).toBe(1);
  });

  test('nộp lại lần hai (đã resubmitted) ⇒ lỗi', async () => {
    const { requestId } = await returnedAtStep2();
    expect((await svc.resubmit(requestId, 'zztv_sale', {})).ok).toBe(true);
    expect(await svc.resubmit(requestId, 'zztv_sale', {})).toMatchObject({ ok: false, reason: NOT_RETURNED_MSG });
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'resubmit' } })).toBe(1);
  });

  test('kiểm "đang bị trả" TRƯỚC kiểm người nộp (thứ tự prod)', async () => {
    const t = await mkTpl(2);
    const { requestId } = await submit(t);
    expect(await svc.resubmit(requestId, 'zztv_kt', {})).toMatchObject({ ok: false, reason: NOT_RETURNED_MSG });
  });

  test('phiếu không tồn tại ⇒ lỗi', async () => {
    expect((await svc.resubmit(999_999, 'zztv_sale', {})).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(5) hai vòng: trả → nộp → trả → nộp', () => {
  test('round = 2, changedFields chỉ so vòng cuối', async () => {
    // Chứng minh: vòng 2 lấy dataBefore mới (ghi đè lúc trả lần 2) ⇒ trường đổi ở vòng 1 không lọt
    // vào bảng "trường đã đổi" vòng 2 (§4.3).
    const { requestId } = await returnedAtStep2();
    expect((await svc.resubmit(requestId, 'zztv_sale', { ghi_chu: 'vòng 1' })).ok).toBe(true);
    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: true, status: 1 }); // duyệt lại bước 1
    expect((await req(requestId)).currentStepOrder).toBe(2);
    expect((await svc.returnToSubmitter(requestId, 'zztv_gd', 'vẫn sai')).ok).toBe(true);
    expect((await svc.resubmit(requestId, 'zztv_sale', { so_tien: 150_000 })).ok).toBe(true);

    const st = await returns.state(OT, requestId);
    expect(st).toMatchObject({ state: 'resubmitted', round: 2, reason: 'vẫn sai' });
    expect(returns.changedFields(st)).toEqual({ so_tien: { cu: 300_000, moi: 150_000 } });
    const f = await form(requestId);
    expect(f).toMatchObject({ ghi_chu: 'vòng 1', so_tien: 150_000 }); // vòng 1 vẫn giữ trong dữ liệu
    expect(await prisma.approvalAction.count({ where: { requestId, action: 'resubmit' } })).toBe(2);
    expect(await liveSigs(requestId)).toBe(0);
    expect((await req(requestId)).currentStepOrder).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(6) sau nộp lại duyệt bình thường tới APPROVED, hiệu ứng tiền đúng MỘT lần', () => {
  test('rút ví: số tiền đã sửa được trừ, một bút toán, số dư khớp', async () => {
    // Chứng minh: phiếu đi hết vòng đời sau nộp lại; hiệu ứng tiền đọc bản ĐÃ HỢP NHẤT và chạy đúng
    // một lần (không trừ theo số cũ, không trừ đôi).
    const { requestId } = await returnedAtStep2();
    expect(await withdrawals()).toBe(0);
    expect((await svc.resubmit(requestId, 'zztv_sale', { so_tien: 200_000 })).ok).toBe(true);

    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: true, status: 1 });
    expect(await svc.approve(requestId, 'zztv_gd')).toEqual({ ok: true, status: 2 });

    const r = await req(requestId);
    expect(r.status).toBe(2);
    expect(r.synced).toBe(true);
    expect(await withdrawals()).toBe(1);
    expect(await wallet.getBalanceTrue(CUS)).toBe(800_000n);
    // Chạy lại tự động hoá không trừ thêm.
    expect(await svc.runAutomation(requestId)).toBe(2);
    expect(await withdrawals()).toBe(1);
    expect(await wallet.getBalanceTrue(CUS)).toBe(800_000n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('(7) G1–G4 không còn chặn sau nộp lại (state = resubmitted)', () => {
  test('G3 approve + G1 runAutomation: tiến bước bình thường', async () => {
    // Chứng minh: cổng chỉ chặn state=returned — resubmit() thật (không phải markResubmitted tay) mở lại phiếu.
    const { requestId } = await returnedAtStep2({ n: 3 });
    await svc.resubmit(requestId, 'zztv_sale', {});
    expect(await returns.activeReturn(prisma as any, OT, requestId)).toBeNull();
    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: true, status: 1 }); // G3 + G1
    expect((await req(requestId)).currentStepOrder).toBe(2);
  });

  test('G4 revoke: người nộp thường thu hồi được sau khi đã nộp lại', async () => {
    const { requestId } = await returnedAtStep2({ allowRevokePending: true });
    expect((await svc.revoke(requestId, 'zztv_sale', 'x')).ok).toBe(false); // đang bị trả ⇒ G4 chặn
    await svc.resubmit(requestId, 'zztv_sale', {});
    expect(await svc.revoke(requestId, 'zztv_sale', 'thôi')).toEqual({ ok: true, status: -2 });
  });

  test('G2 finalize: phiếu 1 bước trả → nộp lại → duyệt ⇒ APPROVED', async () => {
    const t = await mkTpl(1);
    await enableReturn(t.steps[0].id);
    const { requestId } = await submit(t);
    expect((await svc.returnToSubmitter(requestId, 'zztv_kt', 'x')).ok).toBe(true);
    expect((await svc.resubmit(requestId, 'zztv_sale', {})).ok).toBe(true);
    expect(await svc.approve(requestId, 'zztv_kt')).toEqual({ ok: true, status: 2 });
    expect(await withdrawals()).toBe(1);
  });
});
