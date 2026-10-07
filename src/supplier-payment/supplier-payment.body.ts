import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Mã lý do "Trả chứng từ" ⇒ nhãn. Tập mã đúng prod `process_doc_return.php:32-39` (đặc tả 04b §2.2
 * T2, 09a §5.12). ⚠ NHÃN: đặc tả không chép; lấy nguyên văn từ `<select id="dr_reason">` của
 * `components/com_payment/task/list.php` prod (bản sao cục bộ `.deploy_tmp_trave/prod/list.prod.php`
 * dòng 1896-1900) — form đó là nơi DUY NHẤT gửi mã này tới endpoint.
 */
export const DOC_RETURN_REASONS: Readonly<Record<string, string>> = Object.freeze({
  thieu_invoice: 'Thiếu invoice',
  sai_so_tien: 'Sai số tiền',
  sai_stk: 'Sai tên/STK người nhận',
  file_mo: 'File mờ không đọc được',
  khac: 'Khác',
});

/** `POST /supplier-payments/:id/doc-return`. */
export class DocReturnBody {
  @IsString() @IsIn(Object.keys(DOC_RETURN_REASONS)) reasonCode!: string;
  /** "Ghi rõ cho sale". Lý do lưu = nhãn + ': ' + ghi chú, cột `reason`/`note` là varchar(255) —
   *  trần 230 để nhãn dài nhất (22) + ': ' vẫn vừa. */
  @IsOptional() @IsString() @MaxLength(230) note?: string;
}

/**
 * `POST /supplier-payments/:id/doc-resubmit`. `fields` = `$_POST` của form nộp lại prod: khoá là
 * TÊN CỘT PROD (`price_cyn`, `ncc_bank_account`…). Cố ý là object TỰ DO (không whitelist ở tầng
 * DTO): cửa hợp nhất `ReturnService.mergeResubmit` phải THẤY khoá ngoài phạm vi (vd `saler`,
 * `account_code`) để ghi vết `doc_chan_truong` như prod — chặn ở DTO thì vết đó không bao giờ có.
 * Khoá ngoài whitelist KHÔNG bao giờ được ghi (mergeResubmit giữ giá trị cũ).
 */
export class DocResubmitBody {
  @IsObject() fields!: Record<string, unknown>;
  /** prod `rs_note` ⇒ `tbl_payment_log.note` (varchar 255). */
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}
