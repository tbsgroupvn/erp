import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/**
 * Bộ lọc `GET /treasury/accounts/:code/entries` (màn sổ một ví — `com_account/task/view.php`, app
 * `mobile-api/v1/treasury/tx.php`). Tham số lạ ⇒ 400 (ValidationPipe `forbidNonWhitelisted` toàn cục).
 */
export class TreasuryEntriesQuery {
  /** 1 = đã lên sổ · 0 = treo · 9 = huỷ (đặc tả §3.2). Bỏ trống = mọi dòng. */
  @IsOptional() @Type(() => Number) @IsIn([0, 1, 9]) status?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) perPage?: number;
}

/**
 * Bộ lọc `GET /treasury/accounts/:code/statement` (sao kê — R5, đặc tả 09d §2.1/§2.5). Mọi trường là
 * CHUỖI thô rồi đi qua `tbsSkLoc()` — chép prod: giá trị sai định dạng ⇒ về MẶC ĐỊNH, không lỗi. Chỉ tham
 * số LẠ mới 400 (ValidationPipe `forbidNonWhitelisted` toàn cục) — kể cả `tk`/`stk`: mã ví nằm trên path.
 * `type` (link cũ in/out/tranfer) không nhận ở v2: đặc tả §2.5 không liệt kê, v2 không có link cũ.
 */
export class TreasuryStatementQuery {
  @IsOptional() @IsString() @MaxLength(40) fdate?: string;
  @IsOptional() @IsString() @MaxLength(40) tdate?: string;
  @IsOptional() @IsString() @MaxLength(40) chieu?: string;
  @IsOptional() @IsString() @MaxLength(50) nguon?: string;
  @IsOptional() @IsString() @MaxLength(40) tt?: string;
  @IsOptional() @IsString() @MaxLength(255) q?: string;
  @IsOptional() @IsString() @MaxLength(40) min?: string;
  @IsOptional() @IsString() @MaxLength(40) max?: string;
  @IsOptional() @IsString() @MaxLength(40) loai?: string;
  @IsOptional() @IsString() @MaxLength(50) bank?: string;
  @IsOptional() @IsString() @MaxLength(40) sort?: string;
  @IsOptional() @IsString() @MaxLength(40) trang?: string;
  @IsOptional() @IsString() @MaxLength(40) moiTrang?: string;
}

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** `GET /treasury/monthly-flow` (R6 — biểu đồ "Dòng tiền 6 tháng" `/account`). */
export class MonthlyFlowQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number;
}

/** `GET /treasury/quy-trong-ky` (R9 — `/report/bld` phần quỹ). `to` KHÔNG tính (như `bld.php:79`). */
export class QuyTrongKyQuery {
  @IsOptional() @IsString() @Matches(NGAY) from?: string;
  @IsOptional() @IsString() @Matches(NGAY) to?: string;
}

/** `GET /treasury/cost-summary` (R8a — `/account?task=chiphi_ref`). `by=po` ⇒ po_id, còn lại ⇒ container_id. */
export class CostSummaryQuery {
  @IsOptional() @IsIn(['po', 'container']) by?: string;
  @IsOptional() @IsString() @Matches(NGAY) from?: string;
  @IsOptional() @IsString() @Matches(NGAY) to?: string;
}

/** `GET /treasury/suspect-duplicates` (R10c — `/account?task=check_trung`). */
export class SuspectDuplicatesQuery {
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,50}$/) tk?: string;
  // Sai định dạng ⇒ về MẶC ĐỊNH, không lỗi (web `check_trung.php:19-20`; khác tool AI trả lỗi). Khớp
  // mẫu mà không phải ngày lịch (tháng 13…) ⇒ 400 — cùng quy ước sao kê Task 1.
  @IsOptional() @IsString() @MaxLength(40) fdate?: string;
  @IsOptional() @IsString() @MaxLength(40) tdate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) window?: number;
}

/**
 * `GET /treasury/quy-te` (R8d — `/report/quy-te`). Mặc định cả tháng này [ngày 1, ngày 1 tháng sau); `to`
 * nhập vào ⇒ `to 23:59:59` và so `< to` (giây cuối bị loại — vô hại, chép prod `quy-te.php:7-17`).
 */
export class QuyTeQuery {
  @IsOptional() @IsString() @Matches(NGAY) from?: string;
  @IsOptional() @IsString() @Matches(NGAY) to?: string;
}
