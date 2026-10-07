import { BadRequestException, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { RequirePerm } from '../iam/require-perm.decorator';
import { ScopedBy } from '../iam/scoped-by.decorator';
import { TreasuryReadService } from './treasury-read.service';
import { TreasuryReportService } from './treasury-report.service';
import { tbsSkLoc, vnEpoch, vnYmd } from './report-rules';
import {
  CostSummaryQuery,
  MonthlyFlowQuery,
  QuyTeQuery,
  QuyTrongKyQuery,
  SuspectDuplicatesQuery,
  TreasuryEntriesQuery,
  TreasuryStatementQuery,
} from './treasury.query';

/** Ngày `YYYY-MM-DD` + giờ (VN) ⇒ epoch; ngày khớp mẫu nhưng không phải lịch (tháng 13…) ⇒ 400. */
function epoch(ymd: string, hms: string): number {
  const t = vnEpoch(ymd, hms);
  if (t === null) throw new BadRequestException('Ngày không hợp lệ');
  return t;
}
/** Ngày VN lùi `thang` tháng, về ngày 1 (không tràn ngày như `strtotime('-N months')`). */
function ngay1(thang: number): string {
  const [y, m] = vnYmd().split('-').map(Number);
  const t = y * 12 + (m - 1) - thang;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Sổ quỹ công ty (09b đợt 1) — CHỈ ĐỌC. Không có đường ghi quỹ nào qua HTTP ở đợt này (§11.3).
 * Mã quyền `account.view` — đúng mã app prod (`mobile-api/v1/treasury/overview.php`, `tx.php`:
 * `Mobile_Scope::requireScope(..., 'account', 'view')`, đặc tả §4).
 */
@Controller('treasury')
export class TreasuryController {
  constructor(private svc: TreasuryReadService, private report: TreasuryReportService) {}

  private uid(req: any): number {
    return Number(req?.user?.sub);
  }

  @Get('accounts')
  @RequirePerm('account.view')
  accounts(@Req() req: any) {
    return this.svc.overview(this.uid(req));
  }

  @Get('accounts/:code/entries')
  @RequirePerm('account.view')
  @ScopedBy({ entity: 'fundAccount', param: 'code', field: 'code' })
  entries(@Req() req: any, @Param('code') code: string, @Query() q: TreasuryEntriesQuery) {
    return this.svc.entries(this.uid(req), code, q);
  }

  /**
   * Sao kê tài khoản (#09d L11 R5 — `/account/report`, `libs/account_statement.php::tbs_sk_doc`).
   * Quyền chép prod (đặc tả 09d §9): `account.view` + `account.stats` (AND); ScopeGuard giao phạm vi
   * cả hai mã ⇒ chỉ `all` mới qua (fail-closed, mã lạ và ngoài phạm vi cùng một 404).
   */
  @Get('accounts/:code/statement')
  @RequirePerm('account.view', 'account.stats')
  @ScopedBy({ entity: 'fundAccount', param: 'code', field: 'code' })
  statement(@Req() req: any, @Param('code') code: string, @Query() q: TreasuryStatementQuery) {
    const { moiTrang, ...rest } = q;
    const L = tbsSkLoc({ ...rest, moi_trang: moiTrang, tk: code });
    return this.report.statement(this.uid(req), code, L, { phanTrang: true });
  }

  /**
   * Dòng tiền N tháng (#09d L11 R6 — `CLS_TREASURY::monthlyFlow`, biểu đồ `/account`). Quyền chép prod
   * (§9): `account.view` — service đòi phạm vi `all` (403 nếu hẹp hơn).
   */
  @Get('monthly-flow')
  @RequirePerm('account.view')
  monthlyFlow(@Req() req: any, @Query() q: MonthlyFlowQuery) {
    return this.report.monthlyFlow(this.uid(req), q.months ?? 6);
  }

  /**
   * Quỹ trong kỳ cho BGĐ (#09d L11 R9 — `/report/bld` phần quỹ, BẢN SỬA Q-DOC-1) + bảng 12 tháng.
   * Kỳ mặc định như `bld_data.php:21-24`: ngày 1 tháng này 00:00 → NGÀY MAI 00:00 (ngày `to` không tính).
   * Quyền chép prod (§9): `report.report_bld`.
   */
  @Get('quy-trong-ky')
  @RequirePerm('report.report_bld')
  quyTrongKy(@Req() req: any, @Query() q: QuyTrongKyQuery) {
    const from = epoch(q.from ?? ngay1(0), '00:00:00');
    const to = q.to !== undefined ? epoch(q.to, '00:00:00') : epoch(vnYmd(), '00:00:00') + 86400;
    return this.report.quyTrongKy(this.uid(req), from, to, { kem12Thang: true });
  }

  /**
   * Lợi nhuận quỹ ngoại tệ FIFO (#09d L11 R8d — `/report/quy-te`, `libs/fx_quyte.php`). Kỳ mặc định cả tháng
   * này [ngày 1, ngày 1 tháng sau); `to` nhập vào ⇒ `to 23:59:59` (so `<`). Quyền chép prod (§9):
   * `report.report_fxquyte` — service đòi phạm vi `all`.
   */
  @Get('quy-te')
  @RequirePerm('report.report_fxquyte')
  quyTe(@Req() req: any, @Query() q: QuyTeQuery) {
    const from = epoch(q.from ?? ngay1(0), '00:00:00');
    const to = q.to !== undefined ? epoch(q.to, '23:59:59') : epoch(ngay1(-1), '00:00:00');
    return this.report.quyTe(this.uid(req), from, to);
  }

  /**
   * Chi phí theo cont/PO (#09d L11 R8a — `costSummary`, màn `chiphi_ref.php`). Kỳ mặc định (`:15-20`):
   * ngày 1 của tháng cách đây 2 tháng → hôm nay 23:59:59. Quyền chép prod (§9): `account.stats`.
   */
  @Get('cost-summary')
  @RequirePerm('account.stats')
  costSummary(@Req() req: any, @Query() q: CostSummaryQuery) {
    const by = q.by === 'po' ? 'po_id' : 'container_id';
    const from = epoch(q.from ?? ngay1(2), '00:00:00');
    const to = epoch(q.to ?? vnYmd(), '23:59:59');
    return this.report.costSummary(this.uid(req), by, from, to);
  }

  /**
   * Rà trùng sổ quỹ (#09d L11 R10c — `check_trung` / tool AI `so_quy_kiem_trung`). Kỳ mặc định 7 ngày,
   * ngày kết thúc +86.399 giây (§7.3). Ngày sai định dạng ⇒ mặc định (như màn web); khớp mẫu nhưng
   * không phải ngày lịch ⇒ 400. Quyền màn chép prod (§9): `account.stats`.
   */
  @Get('suspect-duplicates')
  @RequirePerm('account.stats')
  suspectDuplicates(@Req() req: any, @Query() q: SuspectDuplicatesQuery) {
    // Mặc định prod (`check_trung.php:13-24`, `agent_core.php:275-281`): Fdate = date('Y-m-d',
    // strtotime('-7 days')) ⇒ 00:00 VN của (hôm nay − 7 ngày lịch); Tdate = hôm nay ⇒ 23:59:59 VN.
    const hopLe = (v: string | undefined) => (v !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
    const tdate = hopLe(q.tdate) ?? vnYmd();
    const fdate = hopLe(q.fdate) ?? vnYmd(new Date(Date.now() - 7 * 86400 * 1000));
    const from = epoch(fdate, '00:00:00');
    const to = epoch(tdate, '00:00:00') + 86399;
    return this.report.suspectDuplicates(this.uid(req), q.tk ?? '', from, to, q.window ?? 30);
  }
}
