import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { DocResubmitBody, DocReturnBody } from './supplier-payment.body';
import { RequirePerm } from '../iam/require-perm.decorator';
import { ScopedBy } from '../iam/scoped-by.decorator';
import { parseIntId } from '../common/int-id';
import { SupplierPaymentService } from './supplier-payment.service';
import { SupplierPaymentListQuery } from './supplier-payment.query';

/**
 * Phiếu thanh toán NCC (09a đợt 1). Mã quyền đúng prod (đặc tả §4):
 *  - đọc: `payment.view` — mã app `mobile-api/v1/payment/list.php` + `detail.php` dùng; web dùng
 *    bit nhóm cũ `Permission('payment')` mà v2 không mang sang (01-iam.md).
 *  - xoá: `payment.delete` — `process_delete.php:12` `PermissionAction('payment','delete')`.
 *  - trả chứng từ / nộp lại (Task 3): `payment.view` — xem hai handler cuối.
 *
 * Route `:id` có @ScopedBy: ScopeGuard quyết "ngoài phạm vi ≡ không tồn tại" bằng MỘT truy vấn
 * TRƯỚC khi handler chạy; service lặp lại đúng điều kiện đó (phòng khi được gọi từ nơi khác).
 */
@Controller('supplier-payments')
export class SupplierPaymentController {
  constructor(private svc: SupplierPaymentService) {}

  private uid(req: any): number {
    return Number(req?.user?.sub);
  }

  private id(raw: string): number {
    const id = parseIntId(raw);
    if (id === null) throw new NotFoundException('Không tìm thấy');
    return id;
  }

  @Get()
  @RequirePerm('payment.view')
  list(@Req() req: any, @Query() q: SupplierPaymentListQuery) {
    return this.svc.list(this.uid(req), q);
  }

  @Get(':id')
  @RequirePerm('payment.view')
  @ScopedBy({ entity: 'supplierPayment', param: 'id', field: 'id' })
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(this.uid(req), this.id(id));
  }

  @Delete(':id')
  @RequirePerm('payment.delete')
  @ScopedBy({ entity: 'supplierPayment', param: 'id', field: 'id' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.delete(this.uid(req), this.id(id));
  }

  /**
   * Trả chứng từ (04b T2). prod: `Permission('payment')` (bit nhóm cũ) — v2 ≡ `payment.view`, cùng
   * cách đọc ở trên. KHÔNG đòi `payment.accept` (endpoint prod không đòi, chỉ nút UI mới ẩn).
   * Chốt "sale không được trả" nằm trong service.
   */
  @Post(':id/doc-return')
  @RequirePerm('payment.view')
  @ScopedBy({ entity: 'supplierPayment', param: 'id', field: 'id' })
  docReturn(@Req() req: any, @Param('id') id: string, @Body() body: DocReturnBody) {
    return this.svc.returnDoc(this.uid(req), this.id(id), body.reasonCode, body.note ?? '');
  }

  /**
   * Nộp lại (04b T4). prod: CHỈ `isLogin` — v2 đóng mặc định nên đòi `payment.view` (người nộp lại
   * phải xem được phiếu của mình). Chốt chủ phiếu / gid 1 nằm trong service.
   */
  @Post(':id/doc-resubmit')
  @RequirePerm('payment.view')
  @ScopedBy({ entity: 'supplierPayment', param: 'id', field: 'id' })
  docResubmit(@Req() req: any, @Param('id') id: string, @Body() body: DocResubmitBody) {
    return this.svc.resubmitDoc(this.uid(req), this.id(id), { fields: body.fields, note: body.note });
  }
}
