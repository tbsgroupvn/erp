import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateService } from './template.service';
import { ApproverResolver } from './approver-resolver';
import { BusinessSyncService, FINALIZE_TX } from './business-sync.service';
import { AStatus } from './approval.constants';
import { isSuperAdmin } from '../iam/super-admin';
import { laSuperAdminHoacKeToan } from '../iam/accountant';
import { ReturnService } from './return.service';

/** Người nộp đã chuẩn hoá (trim). MariaDB prod bỏ qua khoảng trắng CUỐI khi so chuỗi (PAD SPACE) nên
 *  `submitted_by` có khoảng trắng thừa vẫn khớp; Postgres thì KHÔNG ⇒ không trim là người nộp tự duyệt được
 *  phiếu nạp từ prod (review cuối #04b). Mọi phép so người nộp phải đi qua hàm này. */
function submitterOf(req: { submittedBy?: string | null }): string { return (req.submittedBy ?? '').trim(); }

function nowSec() { return Math.floor(Date.now() / 1000); }

/** Nguyên văn câu từ chối của prod approve() — không nêu cờ/nhóm nội bộ nào. */
export const SELF_APPROVE_REFUSED =
  'Bạn là người TRÌNH phiếu này nên không thể tự duyệt (nguyên tắc tách bạch người trình / người duyệt). Cần người khác trong nhóm duyệt.';

/** #04b — `object_type` của phiếu duyệt trong `tbl_return_state` (nguyên văn prod). */
export const RETURN_OBJECT_TYPE = 'approval_request';
/** #04b G3 — nguyên văn prod `approve()` (`cls.approval.php:2446-2448`). */
export const RETURNED_APPROVE_REFUSED = 'Phiếu đang chờ người nộp sửa — không duyệt được.';
/** #04b G4 — nguyên văn prod `revoke()` (`cls.approval.php:3673-3674`). */
export const RETURNED_REVOKE_REFUSED = 'Phiếu đang bị trả về để sửa — hãy sửa và nộp lại, không thu hồi được.';
/** #04b G5 — nguyên văn prod `CLS_TRAVE::tra()`. */
export const RETURN_DISABLED = 'Điểm duyệt này không bật trả về.';
export const RETURN_REASON_REQUIRED = 'Phải ghi lý do trả về.';
/** #04b G6 — nguyên văn prod `resubmit()`. */
export const RESUBMIT_NOT_RETURNED = 'Phiếu này không ở trạng thái chờ sửa.';
export const RESUBMIT_NOT_SUBMITTER = 'Chỉ người nộp phiếu mới nộp lại được.';

/** Một mục người duyệt của bước sau override + SoD. Mục `group` có thể rỗng (bắt buộc, không thoả được). */
type StepEntry = { kind: 'group' | 'user'; members: string[] };

@Injectable()
export class ApprovalService {
  private returns: ReturnService;
  // `returns` tuỳ chọn: Nest luôn tiêm (ReturnService là provider của ApprovalModule); các spec cũ dựng
  // tay `new ApprovalService(prisma, tpl, rr, sync)` thì tự dựng ReturnService trên cùng prisma.
  constructor(private prisma: PrismaService, private tpl: TemplateService,
              private rr: ApproverResolver, private sync: BusinessSyncService, returns?: ReturnService) {
    this.returns = returns ?? new ReturnService(prisma);
  }

  private async currentStep(req: any) {
    const steps = await this.tpl.getSteps(req.templateId, req.resolvedBranchId ?? null);
    return steps.find((s) => s.stepOrder === req.currentStepOrder) ?? null;
  }

  /** Ứng viên hợp lệ của bước, ĐÃ áp override per-request (transfer/added/excluded) + SoD self_approval_action. */
  private async eligibleApprovers(req: any, step: any): Promise<string[]> {
    return [...new Set((await this.stepEntries(req, step)).flatMap((e) => e.members))];
  }

  /**
   * Các MỤC người duyệt của bước (mỗi mục = danh sách username thoả được mục đó), ĐÃ áp override
   * per-request + SoD. Hợp các mục = `eligibleApprovers()` — cổng "ai được bấm" dùng hợp này; bước
   * AND dùng từng mục (D2: một chữ ký mỗi mục, không phải mọi thành viên nhóm).
   *
   * I1 — mục RỖNG: mục `user` rỗng (bị excluded / SoD loại) thì BỎ, như prod gỡ mục đó. Mục `group`
   * rỗng thì GIỮ — bắt buộc và không thoả được (prod luôn giữ mục nhóm) — TRỪ khi chính SoD vừa làm
   * nó rỗng (người nộp là thành viên duy nhất còn lại): prod `skip`/`to_user` gỡ/thay cả mục nhóm đó.
   */
  private async stepEntries(req: any, step: any): Promise<StepEntry[]> {
    const selfSelected: string[] = (() => { try { return JSON.parse(req.formData || '{}').__selfSelected ?? []; } catch { return []; } })();
    const submitter = submitterOf(req);
    let entries: StepEntry[] = (await this.rr.resolveStepEntries(step, { submitterUsername: submitter, selfSelected }))
      .map((e) => ({ kind: e.kind, members: [...e.members] }));
    const without = (u: string) => { for (const e of entries) e.members = e.members.filter((n) => n !== u); };

    // Áp override per-request từ tbl_approval_request_approvers (transfer()/tương lai add/exclude thủ công).
    const overrides = await this.prisma.approvalRequestApprover.findMany({
      where: { requestId: req.id, stepOrder: step.stepOrder },
    });
    for (const o of overrides) {
      if (o.changeType === 'transfer_in' || o.changeType === 'added') entries.push({ kind: 'user', members: [o.username] });
      // enum RequestApproverChange CHỈ có transfer_in | added | excluded.
      // Trước đây còn nhánh `|| changeType === 'removed'` ép kiểu bằng `as any`:
      // Postgres chặn giá trị đó ở tầng enum nên nhánh ấy KHÔNG BAO GIỜ chạy —
      // mã chết gây hiểu nhầm là 'removed' được hỗ trợ. Đã gỡ.
      else if (o.changeType === 'excluded') without(o.username);
    }

    // SoD self_approval_action ÁP SAU CÙNG — người nộp không bao giờ được duyệt phiếu của chính mình,
    // dù override transfer_in/added có nhắc tên người nộp (fail-closed: override không được cấp quyền vượt SoD).
    if (entries.some((e) => e.members.includes(submitter))) {
      if (step.selfApprovalAction === 'skip' || step.selfApprovalAction === 'to_user') {
        // luôn loại người nộp (to_user: kể cả khi selfApprovalRef chưa cấu hình)
        const sodEmptied = new Set(entries.filter((e) => e.members.length === 1 && e.members[0] === submitter));
        without(submitter);
        entries = entries.filter((e) => !sodEmptied.has(e));
        if (step.selfApprovalAction === 'to_user' && step.selfApprovalRef) {
          const u = await this.prisma.user.findUnique({ where: { id: step.selfApprovalRef }, select: { username: true } });
          if (u?.username) entries.push({ kind: 'user', members: [u.username] });
        }
      } // 'self' -> giữ nguyên (chặn tự duyệt nằm ở approve(), xem I2)
    }
    return entries.filter((e) => e.kind === 'group' || e.members.length > 0);
  }

  /**
   * I2 — SoD cứng lúc bấm duyệt, chép prod approve() (libs/cls.approval.php HEAD): người NỘP không tự
   * duyệt phiếu của mình, TRỪ
   *   (a) Super Admin — prod `$isadmin` = CLS_STAFF::laSuperAdmin() = `isSuperAdmin` canonical của v2;
   *   (b) người bấm có `tbl_user.gid` thuộc nhóm `isaccountant=1 AND isactive=1` (prod: chỉ gid 46) —
   *       xét gid PHIÊN của người bấm, KHÔNG xét vai IAM ánh xạ gid.
   * Chặn này ĐỘC LẬP với `self_approval_action` của bước và chạy TRƯỚC: `skip`/`to_user` vẫn gỡ người
   * nộp khỏi danh sách ứng viên (kể cả admin/kế toán); `'self'` (mặc định cột) KHÔNG còn cho người thường
   * tự duyệt — mã prod thắng cấu hình bước, vì đó là thứ đang chạy.
   */
  private async selfApproveExempt(username: string): Promise<boolean> {
    // Định nghĩa dùng chung (src/iam/accountant.ts) — #09d L11 đối soát bank gọi CÙNG hàm này.
    return laSuperAdminHoacKeToan(this.prisma as any, { username });
  }

  private async approvedByAtStep(requestId: number, stepOrder: number): Promise<Set<string>> {
    const acts = await this.prisma.approvalAction.findMany({ where: { requestId, stepOrder, action: 'approve', voided: false } });
    return new Set(acts.map((a) => a.actedBy));
  }

  async approve(requestId: number, actorUsername: string, note?: string) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req || req.isDeleted) return { ok: false, status: -99, reason: 'Phiếu không tồn tại' };
    if (req.status !== AStatus.PENDING) return { ok: false, status: req.status, reason: 'Phiếu không ở trạng thái chờ duyệt' };
    // #04b G3 — sau kiểm PENDING, TRƯỚC SoD/quyền bước (thứ tự prod `:2444-2448`); KHÔNG miễn Super Admin;
    // không ghi hành động. Đây là câu báo sớm cho người bấm — cổng chặn THẬT là G1/G2.
    if (await this.returns.activeReturn(this.prisma, RETURN_OBJECT_TYPE, requestId))
      return { ok: false, status: req.status, reason: RETURNED_APPROVE_REFUSED };
    if (actorUsername === submitterOf(req) && !(await this.selfApproveExempt(actorUsername)))
      return { ok: false, status: req.status, reason: SELF_APPROVE_REFUSED };
    const step = await this.currentStep(req);
    if (!step) return { ok: false, status: req.status, reason: 'Không tìm thấy bước hiện tại' };
    const eligible = await this.eligibleApprovers(req, step);
    if (!eligible.includes(actorUsername)) return { ok: false, status: req.status, reason: 'Không có quyền duyệt bước này' };

    await this.prisma.approvalAction.create({ data: {
      requestId, stepOrder: step.stepOrder, stepName: step.stepName, action: 'approve',
      actedBy: actorUsername, actedAt: nowSec(), note: note ?? null,
    }});
    const r = await this.runAutomationDetailed(requestId);
    // Đã ghi lượt duyệt nhưng hiệu ứng tiền không thành ⇒ phiếu VẪN chờ duyệt (xem finalize()).
    if (r.error) return { ok: false, status: r.status, reason: 'Đã ghi lượt duyệt nhưng CHƯA hoàn tất: ' + r.error };
    return { ok: true, status: r.status };
  }

  /**
   * Khoá dòng phiếu (FOR UPDATE) và đọc lại trạng thái. Mọi chuyển trạng thái (duyệt xong, từ chối,
   * thu hồi, trả về) đi qua khoá này ⇒ không lượt nào ghi đè kết quả của lượt khác — đặc biệt không
   * có "từ chối" chen vào giữa lúc lượt duyệt cuối đang trừ ví.
   */
  private async lockPending(tx: any, requestId: number): Promise<{ status: number; currentStepOrder: number } | null> {
    const rows = await tx.$queryRaw`
      SELECT status, current_step_order AS "currentStepOrder" FROM tbl_approval_requests WHERE id = ${requestId} FOR UPDATE`;
    return (rows as { status: number; currentStepOrder: number }[])[0] ?? null;
  }

  async reject(requestId: number, actorUsername: string, note: string) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== AStatus.PENDING) return { ok: false, status: req?.status ?? -99, reason: 'Không ở trạng thái chờ' };
    const step = await this.currentStep(req);
    if (!step) return { ok: false, status: req.status, reason: 'Không có bước' };
    const eligible = await this.eligibleApprovers(req, step);
    if (!eligible.includes(actorUsername)) return { ok: false, status: req.status, reason: 'Không có quyền' };
    return this.prisma.$transaction(async (tx) => {
      const cur = await this.lockPending(tx, requestId);
      if (!cur || cur.status !== AStatus.PENDING) return { ok: false, status: cur?.status ?? -99, reason: 'Không ở trạng thái chờ' };
      // Hiệu ứng tiền ĐÃ vào sổ (sập giữa lúc trừ ví và đổi trạng thái) ⇒ không được từ chối:
      // "từ chối mà ví đã trừ" thì không ai hoàn tiền. resumeUnfinished() sẽ hoàn tất phiếu.
      if (await this.sync.isApplied(requestId))
        return { ok: false, status: cur.status, reason: 'Phiếu đã hạch toán ví — chờ hệ thống hoàn tất duyệt' };
      await tx.approvalAction.create({ data: {
        requestId, stepOrder: step.stepOrder, stepName: step.stepName, action: 'reject',
        actedBy: actorUsername, actedAt: nowSec(), note,
      }});
      await tx.approvalRequest.update({ where: { id: requestId }, data: { status: AStatus.REJECTED, finishedAt: nowSec() } });
      return { ok: true, status: AStatus.REJECTED };
    }, FINALIZE_TX);
  }

  async revoke(requestId: number, actorUsername: string, note?: string) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== AStatus.PENDING) return { ok: false, status: req?.status ?? -99, reason: 'Không ở trạng thái chờ' };
    if (submitterOf(req) !== actorUsername) return { ok: false, status: req.status, reason: 'Chỉ người nộp được thu hồi' };
    const t = await this.prisma.approvalTemplate.findUnique({ where: { id: req.templateId } });
    if (!t?.allowRevokePending) return { ok: false, status: req.status, reason: 'Mẫu không cho thu hồi' };
    return this.prisma.$transaction(async (tx) => {
      const cur = await this.lockPending(tx, requestId);
      if (!cur || cur.status !== AStatus.PENDING) return { ok: false, status: cur?.status ?? -99, reason: 'Không ở trạng thái chờ' };
      // #04b G4 — đang bị trả về ⇒ người thường không thu hồi (phải sửa & nộp lại); Super Admin qua được
      // (prod `:3673-3674`, `intval($isadmin) != 1`). Đọc dưới khoá dòng phiếu bằng cùng tx.
      if (await this.returns.activeReturn(tx, RETURN_OBJECT_TYPE, requestId)) {
        const actor = await tx.user.findUnique({ where: { username: actorUsername }, select: { isSuperAdmin: true } });
        if (!isSuperAdmin(actor)) return { ok: false, status: cur.status, reason: RETURNED_REVOKE_REFUSED };
      }
      if (await this.sync.isApplied(requestId))
        return { ok: false, status: cur.status, reason: 'Phiếu đã hạch toán ví — chờ hệ thống hoàn tất duyệt' };
      await tx.approvalAction.create({ data: {
        requestId, stepOrder: cur.currentStepOrder, action: 'revoke',
        actedBy: actorUsername, actedAt: nowSec(), note: note ?? null,
      }});
      await tx.approvalRequest.update({ where: { id: requestId }, data: { status: AStatus.REVOKED, finishedAt: nowSec() } });
      return { ok: true, status: AStatus.REVOKED };
    }, FINALIZE_TX);
  }

  /**
   * #04b G5 — "trả về cho người nộp sửa" (prod `CLS_APPROVAL::returnToSubmitter()` `:2965-2989` +
   * `CLS_TRAVE::tra()`). Phiếu ĐỨNG YÊN: KHÔNG đổi `currentStepOrder`, KHÔNG đổi `pendingSince` (§2.1),
   * không huỷ chữ ký — chỉ ghi dòng `ReturnState` = `returned`; G1/G2/G3 lo phần "không ai duyệt được".
   * (Mã cũ kéo phiếu về bước đầu mà không khoá gì — chữ ký cũ còn nguyên ⇒ lượt kế tiếp tiến bước lại.)
   * Cấu hình theo ĐIỂM DUYỆT = `String(step.id)` (id bước), không phải `stepOrder`.
   * KHÔNG kiểm `allowReturn` và KHÔNG kiểm "đang bị trả rồi" (prod không kiểm — gọi lại ⇒ `round+1`).
   * Không báo tin (v2 chưa có module thông báo).
   */
  async returnToSubmitter(requestId: number, actorUsername: string, reason: string) {
    const why = reason ?? '';
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== AStatus.PENDING) return { ok: false, status: req?.status ?? -99, reason: 'Không ở trạng thái chờ' };
    const step = await this.currentStep(req);
    if (!step) return { ok: false, status: req.status, reason: 'Không có bước' };
    const eligible = await this.eligibleApprovers(req, step);
    if (!eligible.includes(actorUsername)) return { ok: false, status: req.status, reason: 'Không có quyền' };
    return this.prisma.$transaction(async (tx) => {
      // Khoá dòng phiếu TRƯỚC khi ghi trạng thái trả về (điều kiện của ReturnService.returnObject) ⇒
      // tuần tự hoá với finalize(): G2 đọc ReturnState dưới cùng khoá này.
      const cur = await this.lockPending(tx, requestId);
      if (!cur || cur.status !== AStatus.PENDING) return { ok: false, status: cur?.status ?? -99, reason: 'Không ở trạng thái chờ' };
      // Bước đã đổi giữa lúc kiểm quyền và lúc lấy khoá ⇒ quyền + điểm duyệt vừa kiểm không còn đúng.
      if (cur.currentStepOrder !== step.stepOrder)
        return { ok: false, status: cur.status, reason: 'Phiếu đã chuyển bước — tải lại rồi thử lại' };
      // Như reject/revoke: ví ĐÃ trừ (sập giữa chừng) thì không trả về — lượt quét hoàn tất phiếu.
      if (await this.sync.isApplied(requestId))
        return { ok: false, status: cur.status, reason: 'Phiếu đã hạch toán ví — chờ hệ thống hoàn tất duyệt' };
      const ref = String(step.id);
      const cfg = await this.returns.config('approval', ref);
      if (!cfg) return { ok: false, status: cur.status, reason: RETURN_DISABLED };
      if (cfg.requireReason && !why.trim()) return { ok: false, status: cur.status, reason: RETURN_REASON_REQUIRED };
      let dataBefore: unknown = null;
      try { dataBefore = req.formData ? JSON.parse(req.formData) : null; } catch { dataBefore = null; }
      await this.returns.returnObject(tx, {
        objectType: RETURN_OBJECT_TYPE, objectId: requestId, checkpointType: 'approval', checkpointRef: ref,
        reason: why, fieldsOpened: await this.returns.editableFields('approval', ref), dataBefore,
        returnedBy: actorUsername,
      });
      await tx.approvalAction.create({ data: {
        requestId, stepOrder: step.stepOrder, stepName: step.stepName, action: 'return_submitter',
        actedBy: actorUsername, actedAt: nowSec(), note: 'Trả người nộp sửa: ' + why,
      }});
      return { ok: true, status: AStatus.PENDING };
    }, FINALIZE_TX);
  }

  /**
   * #04b G6 — người nộp gửi lại phiếu sau khi sửa (prod `CLS_APPROVAL::resubmit()` `:2993-3039`, §2.4).
   * Cửa DUY NHẤT: chỉ `submittedBy.trim() === actor` (không miễn Super Admin, không tính người nộp-hộ);
   * KHÔNG kiểm `status` (khớp prod — ghi chú A2). Hợp nhất theo cấu hình HIỆN TẠI của điểm duyệt đã trả
   * (`editableFields`, không phải ảnh chụp `fieldsOpened`), rồi: về bước 1 (hằng số — Q2, không giải lại
   * nhánh), `noAutoDedup`, `pendingSince=now`, HUỶ MỌI chữ ký `approve`/`auto_approve` cũ (duyệt lại từ
   * đầu), ghi hành động `resubmit`, đánh dấu ReturnState `resubmitted`. KHÔNG gọi `runAutomation` (Q3).
   * Khác prod (không đổi kết quả nghiệp vụ): mọi ghi nằm trong MỘT transaction dưới `lockPending()` —
   * prod chạy từng câu rời. Chưa có: báo tin (chưa có module), kiểm tiền sạch `appr_kiem_tien_sach`
   * (submit() của v2 cũng chưa có).
   */
  async resubmit(requestId: number, actorUsername: string, formDataMoi: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const cur = await this.lockPending(tx, requestId);
      if (!cur) return { ok: false, status: -99, reason: 'Phiếu không tồn tại' };
      const st = await this.returns.activeReturn(tx, RETURN_OBJECT_TYPE, requestId);
      if (!st) return { ok: false, status: cur.status, reason: RESUBMIT_NOT_RETURNED };
      const req = await tx.approvalRequest.findUniqueOrThrow({ where: { id: requestId } });
      if (submitterOf(req) !== actorUsername) return { ok: false, status: cur.status, reason: RESUBMIT_NOT_SUBMITTER };

      // form_data lưu dạng chuỗi JSON (như submit()); không phải object ⇒ coi như rỗng (prod `is_array($cu)?:[]`).
      let cu: Record<string, unknown> = {};
      try {
        const p = req.formData ? JSON.parse(req.formData) : null;
        if (p && typeof p === 'object' && !Array.isArray(p)) cu = p;
      } catch { /* giữ {} */ }
      const allowed = await this.returns.editableFields('approval', st.checkpointRef);
      const { data, doi } = this.returns.mergeResubmit(allowed, cu, formDataMoi ?? {});
      const n = Object.keys(doi).length;
      const now = nowSec();

      await tx.approvalRequest.update({
        where: { id: requestId },
        data: { formData: JSON.stringify(data), currentStepOrder: 1, noAutoDedup: true, pendingSince: now },
      });
      await tx.approvalAction.updateMany({
        where: { requestId, action: { in: ['approve', 'auto_approve'] }, voided: false },
        data: { voided: true },
      });
      await tx.approvalAction.create({ data: {
        requestId, stepOrder: 1, stepName: 'Nộp lại', action: 'resubmit',
        actedBy: actorUsername, actedAt: now, note: 'Nộp lại sau khi sửa' + (n > 0 ? ` (${n} trường đổi)` : ''),
      }});
      await this.returns.markResubmitted(tx, RETURN_OBJECT_TYPE, requestId, data);
      return { ok: true, status: cur.status, fieldsChanged: n };
    }, FINALIZE_TX);
  }

  async transfer(requestId: number, actorUsername: string, toUsername: string, note?: string) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req || req.status !== AStatus.PENDING) return { ok: false, status: req?.status ?? -99, reason: 'Không ở trạng thái chờ' };
    const step = await this.currentStep(req);
    if (!step) return { ok: false, status: req.status, reason: 'Không có bước' };
    if (!step.allowTransfer) return { ok: false, status: req.status, reason: 'Bước không cho chuyển tiếp' };
    const eligible = await this.eligibleApprovers(req, step);
    if (!eligible.includes(actorUsername)) return { ok: false, status: req.status, reason: 'Không có quyền' };
    await this.prisma.approvalRequestApprover.create({ data: {
      requestId, stepOrder: step.stepOrder, username: toUsername, changeType: 'transfer_in',
    }});
    await this.prisma.approvalAction.create({ data: {
      requestId, stepOrder: step.stepOrder, stepName: step.stepName, action: 'transfer',
      actedBy: actorUsername, actedAt: nowSec(), note: note ?? null,
    }});
    return { ok: true, status: req.status };
  }

  /** Trả trạng thái phiếu sau khi tự động chuyển bước. */
  async runAutomation(requestId: number): Promise<number> {
    return (await this.runAutomationDetailed(requestId)).status;
  }

  private async runAutomationDetailed(requestId: number): Promise<{ status: number; error?: string; flipped?: boolean }> {
    // Vòng lặp: hoàn tất bước hiện tại thì tiến; xử lý bước auto/empty; dừng khi cần người hoặc hết bước.
    for (let guard = 0; guard < 100; guard++) {
      const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== AStatus.PENDING) return { status: req?.status ?? AStatus.REJECTED };
      // #04b G1 — ĐIỂM HỢP LƯU: phiếu đang chờ người nộp sửa thì không tiến bước, không finalize — phủ
      // approve(), lượt quét resumeUnfinished() và mọi caller tương lai. Kiểm MỖI vòng.
      if (await this.returns.activeReturn(this.prisma, RETURN_OBJECT_TYPE, requestId)) return { status: AStatus.PENDING };
      const steps = await this.tpl.getSteps(req.templateId, req.resolvedBranchId ?? null);
      const idx = steps.findIndex((s) => s.stepOrder === req.currentStepOrder);
      const step: any = steps[idx];
      if (!step) return { status: req.status };

      const entries = await this.stepEntries(req, step);
      const eligible = [...new Set(entries.flatMap((e) => e.members))];
      const approvedBy = await this.approvedByAtStep(requestId, step.stepOrder);

      let stepDone = false;
      if (step.approvalMode === 'auto_approve') stepDone = true;
      else if (entries.length === 0) {
        // KHÔNG có mục nào (prod `empty($resolved)`) -> empty_approver_action. Mục nhóm rỗng KHÔNG tính
        // là "không có mục" (I1): prod luôn giữ mục nhóm nên bước đó đứng chờ, không tới nhánh này.
        if (step.emptyApproverAction === 'auto_approve') stepDone = true;
        else return { status: req.status }; // to_user/to_admin: dừng, cần can thiệp (ngoài phạm vi task)
      } else if (step.nodeType === 'AND') {
        // (Chỉ còn mục nhóm rỗng ⇒ eligible rỗng ⇒ cả ba nhánh dưới đều ra false ⇒ đứng chờ, fail-closed.)
        // D2 — prod isStepFullySatisfied(): MỖI MỤC cần một chữ ký; mục nhóm được thoả bởi MỘT thành
        // viên. Mục nhóm rỗng không bao giờ thoả (I1).
        stepDone = entries.every((e) => e.members.some((n) => approvedBy.has(n)));
      } else if (step.nodeType === 'SEQ') {
        // SEQ: GIỮ NGUYÊN (prod 0 bước SEQ). Chưa ép thứ tự; đòi đủ mọi ứng viên (multi-eye safe);
        // có mục nhóm rỗng thì không bao giờ xong (I1).
        stepDone = entries.every((e) => e.members.length > 0) && eligible.every((n) => approvedBy.has(n));
      } else stepDone = eligible.some((n) => approvedBy.has(n)); // OR

      if (!stepDone) return { status: req.status }; // chờ thêm người duyệt

      // tiến bước — có điều kiện: phiếu vẫn chờ và vẫn đứng ở ĐÚNG bước vừa xét
      const next = steps[idx + 1];
      if (next) {
        await this.advanceStep(requestId, step.stepOrder, next.stepOrder);
        continue;
      }
      // hết bước -> chạy hiệu ứng nghiệp vụ RỒI MỚI APPROVED
      return this.finalize(requestId, step.stepOrder);
    }
    return { status: AStatus.PENDING };
  }

  /**
   * I-1 — hiệu ứng tiền TRƯỚC, đổi trạng thái SAU, dưới cùng một khoá dòng phiếu.
   *
   * Phiếu còn PENDING suốt lúc trừ ví ⇒ tiền giữ (HoldService chỉ tính phiếu status=1) còn hiệu lực
   * với MỌI lệnh tiêu khác; handler trừ với `holdExcludeRequest` = chính phiếu nên không tự chặn mình.
   * Hiệu ứng thất bại ⇒ giao dịch commit NHƯNG không đổi trạng thái: phiếu ở lại PENDING, tiền vẫn
   * giữ, nhận xét "[VI] TRU VI THAT BAI" nằm trên phiếu. Không còn đường nào để phiếu APPROVED mà
   * ví chưa trừ.
   *
   * `applyEntry` tự mở transaction riêng trên kết nối khác (không được đổi — chốt chặn ví âm), nên
   * "cùng transaction" ở đây nghĩa là: dòng phiếu bị khoá FOR UPDATE từ trước khi trừ tới sau khi đổi
   * trạng thái. Sập giữa hai mốc (ví đã trừ, trạng thái chưa đổi) ⇒ phiếu PENDING + bút toán đã neo
   * refKey; `resumeUnfinished()` hoàn tất nó, còn reject/revoke/returnToSubmitter bị chặn vì `isApplied`.
   */
  /** Tiến phiếu từ bước `from` sang `to` — có điều kiện: phiếu vẫn chờ và vẫn đứng ở ĐÚNG bước `from`.
   *  #04b M1 (review cuối): chạy dưới CÙNG khoá dòng phiếu mà returnToSubmitter() lấy, và kiểm lại trạng
   *  thái trả về TRONG khoá — trả về chen giữa G1 và lúc tiến bước thì phiếu đứng yên ở bước hiện tại
   *  (vòng lặp kế tiếp gặp G1 và dừng). Trước đây là `updateMany` ngoài khoá ⇒ phiếu đang bị trả vẫn nhảy bước. */
  private async advanceStep(requestId: number, from: number, to: number): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const cur = await this.lockPending(tx, requestId);
      if (!cur || cur.status !== AStatus.PENDING || cur.currentStepOrder !== from) return;
      if (await this.returns.activeReturn(tx, RETURN_OBJECT_TYPE, requestId)) return;
      await tx.approvalRequest.update({ where: { id: requestId }, data: { currentStepOrder: to, pendingSince: nowSec() } });
    }, FINALIZE_TX);
  }

  private async finalize(requestId: number, stepOrder: number): Promise<{ status: number; error?: string; flipped?: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const cur = await this.lockPending(tx, requestId);
      if (!cur) return { status: AStatus.REJECTED };
      if (cur.status !== AStatus.PENDING || cur.currentStepOrder !== stepOrder) return { status: cur.status };
      // #04b G2 — dưới khoá dòng phiếu, đọc bằng CÙNG tx: trả về chen vào giữa G1 và lúc lấy khoá này
      // (returnToSubmitter lấy CÙNG khoá trước khi ghi) ⇒ không chạy hiệu ứng tiền, không APPROVED.
      if (await this.returns.activeReturn(tx, RETURN_OBJECT_TYPE, requestId)) return { status: AStatus.PENDING };
      const eff = await this.sync.runEffect(requestId);
      if (!eff.ok) return { status: AStatus.PENDING, error: eff.msg };
      await tx.approvalRequest.update({
        where: { id: requestId }, data: { status: AStatus.APPROVED, finishedAt: nowSec(), synced: true },
      });
      return { status: AStatus.APPROVED, flipped: true }; // CHÍNH lượt này đổi trạng thái
    }, FINALIZE_TX);
  }

  /**
   * Lượt quét sau sự cố (chạy định kỳ). An toàn khi chạy lại: mọi hiệu ứng tiền neo refKey.
   *  (a) APPROVED + synced=false — dữ liệu từ mã cũ/đường khác: chạy hiệu ứng RỒI MỚI đánh synced.
   *  (b) PENDING mà hiệu ứng ĐÃ vào sổ — sập giữa lúc trừ ví và đổi trạng thái: hoàn tất phiếu.
   * KHÔNG tự duyệt phiếu PENDING chưa có hiệu ứng (vd lần trừ trước thất bại vì thiếu số dư): đó là
   * việc của kế toán — kiểm số dư rồi duyệt lại, đúng như nhận xét trên phiếu dặn.
   *
   * ⛔ SÀN CUTOVER (review cuối, I-1): lượt quét CHỈ đụng phiếu mà hệ mới đã xử lý SAU mốc
   * `APPROVAL_SWEEP_CUTOVER_AT` (giây unix). Thiếu/sai cấu hình ⇒ KHÔNG chạy gì (fail-closed) — thiếu
   * cấu hình không bao giờ được hiểu là "không có sàn". Lý do: prod để lại phiếu rút APPROVED mà không
   * trừ ví khi trừ thất bại (viRutTienDuyetXong chỉ ghi nhận xét); nạp sang với synced=false (mặc định
   * của cột) là lượt quét đầu tiên sẽ trừ ví khách hàng tuần sau, không người nào duyệt lại.
   *  - (a) xét `finishedAt` — thời điểm phiếu thành APPROVED. Phiếu kết thúc trên prod có finishedAt
   *    trước mốc; phiếu hệ mới duyệt xong (finalize ghi finishedAt=now) nằm sau mốc. NULL ⇒ từ chối.
   *    Không dùng submittedAt: phiếu nộp trên prod, duyệt ở hệ mới vẫn phải quét được.
   *  - (b) phiếu còn PENDING nên chưa có finishedAt ⇒ xét "hệ mới đã chạm vào phiếu": nộp sau mốc
   *    (`submittedAt`) HOẶC có lượt duyệt (approve, chưa huỷ) sau mốc — lượt duyệt đó là thứ đã khởi
   *    động finalize bị sập. Phiếu chờ nạp từ prod mà chưa ai duyệt ở hệ mới ⇒ từ chối.
   */
  async resumeUnfinished(): Promise<SweepResult> {
    const out: SweepResult = { ran: false, synced: [], finalized: [], failed: [], refused: [], refusedCount: 0 };
    const cfg = sweepFloor();
    if ('error' in cfg) { out.reason = cfg.error; return out; }
    const floor = cfg.floor;
    out.ran = true;

    // (a) — phiếu trước sàn: chỉ đếm + liệt kê một phần để báo, KHÔNG chạy.
    const aBase = { status: AStatus.APPROVED, synced: false, isDeleted: false };
    const preFloor = { OR: [{ finishedAt: null }, { finishedAt: { lt: floor } }] };
    out.refusedCount += await this.prisma.approvalRequest.count({ where: { ...aBase, ...preFloor } });
    for (const { id } of await this.prisma.approvalRequest.findMany({
      where: { ...aBase, ...preFloor }, select: { id: true }, orderBy: { id: 'asc' }, take: 50,
    })) out.refused.push({ id, reason: 'APPROVED trước sàn cutover (finishedAt < ' + floor + ' hoặc NULL)' });

    const a = await this.prisma.approvalRequest.findMany({
      where: { ...aBase, finishedAt: { gte: floor } }, select: { id: true }, orderBy: { id: 'asc' },
    });
    for (const { id } of a) {
      try { if (await this.sync.onApproved(id)) out.synced.push(id); } // false ⇒ lượt/máy khác đã làm
      catch (e) { out.failed.push({ id, msg: (e as Error)?.message ?? String(e) }); }
    }

    const types = this.sync.handledTypes();
    const b = types.length ? await this.prisma.approvalRequest.findMany({
      where: { status: AStatus.PENDING, isDeleted: false, objectType: { in: types } },
      select: { id: true, submittedAt: true }, orderBy: { id: 'asc' },
    }) : [];
    for (const { id, submittedAt } of b) {
      if (!(await this.sync.isApplied(id))) continue;
      const touched = submittedAt >= floor || (await this.prisma.approvalAction.count({
        where: { requestId: id, action: 'approve', voided: false, actedAt: { gte: floor } },
      })) > 0;
      if (!touched) {
        out.refusedCount++;
        out.refused.push({ id, reason: 'PENDING đã có bút toán nhưng hệ mới chưa xử lý sau sàn cutover' });
        continue;
      }
      const r = await this.runAutomationDetailed(id);
      if (r.flipped) out.finalized.push(id); // APPROVED do lượt/máy khác ⇒ không báo trùng
      else if (r.error) out.failed.push({ id, msg: r.error });
    }
    return out;
  }
}

export type SweepResult = {
  /** false ⇒ không chạy gì; lý do ở `reason` (vd thiếu sàn cutover). */
  ran: boolean;
  reason?: string;
  synced: number[];
  finalized: number[];
  failed: { id: number; msg: string }[];
  /** Tối đa 50 phiếu bị từ chối vì nằm trước sàn — tổng thật ở `refusedCount`. */
  refused: { id: number; reason: string }[];
  refusedCount: number;
};

/** Biến môi trường BẮT BUỘC của lượt quét: mốc cutover, giây unix (không phải mili giây). */
export const SWEEP_FLOOR_ENV = 'APPROVAL_SWEEP_CUTOVER_AT';

/** Đọc sàn cutover. Thiếu / không phải số nguyên dương / trông như mili giây ⇒ lỗi (fail-closed). */
export function sweepFloor(): { floor: number } | { error: string } {
  const raw = (process.env[SWEEP_FLOOR_ENV] ?? '').trim();
  if (!raw) return { error: `${SWEEP_FLOOR_ENV} chưa đặt — lượt quét KHÔNG chạy (thiếu sàn cutover không có nghĩa là "không có sàn")` };
  if (!/^\d+$/.test(raw) || Number(raw) <= 0)
    return { error: `${SWEEP_FLOOR_ENV}="${raw}" không phải số giây unix dương — lượt quét KHÔNG chạy` };
  // Cột finished_at/submitted_at/acted_at là INT4 — giá trị lớn hơn không so được (Prisma ném), và
  // gần như chắc chắn là mili giây gõ nhầm.
  if (Number(raw) > 2_147_483_647)
    return { error: `${SWEEP_FLOOR_ENV}="${raw}" trông như MILI giây (vượt INT4) — cần giây unix; lượt quét KHÔNG chạy` };
  return { floor: Number(raw) };
}
