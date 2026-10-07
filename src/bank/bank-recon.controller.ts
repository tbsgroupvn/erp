import { BadRequestException, Controller, Get, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RequirePerm } from '../iam/require-perm.decorator';
import { vnEpoch, vnYmd } from '../treasury/report-rules';
import { BankReconService } from './bank-recon.service';

/**
 * `GET /bank/recon` (R10a — `ajaxs/bank/recon_list.php`). Ngày sai định dạng ⇒ MẶC ĐỊNH (prod
 * `strtotime` false ⇒ mặc định); khớp mẫu mà không phải ngày lịch (tháng 13…) ⇒ 400 (quy ước Task 1-2).
 * `window` prod `max(0,(int))` không trần — v2 giới hạn 0–60 và giá trị âm ⇒ 400 (không kẹp im lặng).
 */
export class BankReconQuery {
  @IsOptional() @IsString() @MaxLength(40) fdate?: string;
  @IsOptional() @IsString() @MaxLength(40) tdate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) window?: number;
}

const hopLe = (v: string | undefined) => (v !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
function epoch(ymd: string, hms: string): number {
  const t = vnEpoch(ymd, hms);
  if (t === null) throw new BadRequestException('Ngày không hợp lệ');
  return t;
}

/**
 * Đối soát bank TK01 (#09d L11 R10a/b) — CHỈ ĐỌC. Quyền (đặc tả 09d §9, chép prod): Super Admin HOẶC nhóm
 * kế toán — service kiểm (`laSuperAdminHoacKeToan`); `account.view` là cổng route (màn nằm trong `/account`).
 */
@Controller('bank')
export class BankReconController {
  constructor(private svc: BankReconService) {}

  @Get('recon')
  @RequirePerm('account.view')
  recon(@Req() req: any, @Query() q: BankReconQuery) {
    const f = hopLe(q.fdate);
    const t = hopLe(q.tdate);
    // prod: fdate mặc định strtotime(date('Y-m-01')) = 00:00 VN ngày 1 tháng này; tdate mặc định time().
    const fd = epoch(f ?? vnYmd().slice(0, 8) + '01', '00:00:00');
    const td = t !== null ? epoch(t, '23:59:59') : Math.floor(Date.now() / 1000);
    return this.svc.reconList(Number(req?.user?.sub), fd, td, q.window ?? 3);
  }

  @Get('fx-unaccounted')
  @RequirePerm('account.view')
  fxUnaccounted(@Req() req: any) {
    return this.svc.fxUnaccounted(Number(req?.user?.sub));
  }
}
