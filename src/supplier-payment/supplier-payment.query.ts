import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Bộ lọc `GET /supplier-payments` — tập con của web `/payment` (`components/com_payment/task/list.php`)
 * đủ cho đợt 1. Tham số lạ ⇒ 400 (ValidationPipe `forbidNonWhitelisted` toàn cục), nên không ai
 * chèn được `saler=` để "tự chọn" phạm vi — phạm vi CHỈ đến từ quyền của người gọi.
 */
export class SupplierPaymentListQuery {
  /** Lọc duyệt (prod `confirm='yes'|'no'`). */
  @IsOptional() @IsIn(['yes', 'no']) confirm?: 'yes' | 'no';
  /** Lọc "Đã TT" (prod `payment='yes'|'no'`). */
  @IsOptional() @IsIn(['yes', 'no']) payment?: 'yes' | 'no';
  /** Nhãn nguồn tệ (`source`), so bằng. */
  @IsOptional() @IsString() @MaxLength(50) source?: string;
  /** `pay_type`: `''` (luồng cũ) | `supplier` (từ PO). */
  @IsOptional() @IsIn(['', 'supplier']) payType?: '' | 'supplier';
  /** Mọi phiếu của một PO (link từ `po/view`). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) poId?: number;
  /** Tìm theo mã phiếu: như web (23/09/2026) BỎ mọi bộ lọc khác — chỉ còn phạm vi của người gọi. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  /** Như app (`per_page`): mặc định 20, trần 100. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) perPage?: number;
}
