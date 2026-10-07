import { Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';
import { RequirePerm } from '../iam/require-perm.decorator';
import { ScopedBy } from '../iam/scoped-by.decorator';
import { parseIntId } from '../common/int-id';
import { PoTienNccService } from './po-tien-ncc.service';

/**
 * #09d L11 R8c — tiền NCC của PO (khối "chi − hoàn = còn" ở `po/view.php:684-719`). CHỈ ĐỌC.
 * Quyền (đặc tả 09d §9): `po.view` + phạm vi PO (ScopeGuard entity `purchaseOrder`, service kiểm lại).
 */
@Controller('po')
export class PoTienNccController {
  constructor(private svc: PoTienNccService) {}

  @Get(':id/tien-ncc')
  @RequirePerm('po.view')
  @ScopedBy({ entity: 'purchaseOrder', param: 'id', field: 'id' })
  tienNcc(@Req() req: any, @Param('id') id: string) {
    const poId = parseIntId(id);
    if (poId === null) throw new NotFoundException('Không tìm thấy');
    return this.svc.poTienNcc(Number(req?.user?.sub), poId);
  }
}
