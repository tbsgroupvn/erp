import { Controller, Get, Post, Param } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { RequirePerm } from '../iam/require-perm.decorator';
import { ScopedBy } from '../iam/scoped-by.decorator';
import { toWalletAvailableDto, toWalletRepairDto } from '../common/dto/wallet.dto';

@Controller('wallets')
export class WalletController {
  constructor(private wallet: WalletService) {}

  // Mã khách (`cusId`) theo định dạng tuần tự đoán được (`TBS4125`) — trước
  // Task 1 (kế hoạch @RequirePerm nhận biết PHẠM VI) @RequirePerm một mình
  // chỉ xác nhận "có quyền gọi route", không xác nhận "khách này có nằm
  // trong phạm vi của người gọi" — sale phạm vi `own` vẫn dò được số dư của
  // MỌI khách bằng cách duyệt hết `TBS0001..TBS9999`. @ScopedBy đóng lỗ đó:
  // ScopeGuard (chạy sau PermGuard) đối chiếu `cusId` với `Customer.code`
  // trong ĐÚNG phạm vi của `wallet.view`, khách ngoài phạm vi nhận 404 giống
  // hệt khách không tồn tại. `wallet.view` là quyền ĐỌC — sale/CSKH được cấp
  // để tra cứu.
  @Get(':cusId/available')
  @RequirePerm('wallet.view')
  @ScopedBy({ entity: 'customer', param: 'cusId', field: 'code' })
  async available(@Param('cusId') cusId: string) {
    const balance = await this.wallet.getBalanceTrue(cusId);
    const available = await this.wallet.getBalanceAvailable(cusId);
    return toWalletAvailableDto(balance, available);
  }

  // GHI thẳng `tbl_wallet.total` (giữ khoá dòng FOR UPDATE trong lúc chạy) — đây
  // là thao tác SỬA sổ ví, không phải tra cứu. `wallet.repair` là quyền CAO HƠN
  // `wallet.view`: recompute cache là hành động sửa-sổ-kế-toán, không dành cho sale.
  //
  // ⚠ "CAO HƠN" nay là MÃ, không còn là quy ước thiết kế vai (Ruling 4 của review
  // cuối nhánh feat/api-dot1). Bản cũ ghi trong chú thích "không role nào có
  // wallet.repair mà thiếu wallet.view" — không role nào cài, không dòng mã nào
  // ép, và test chỉ canh chiều NGƯỢC LẠI (vốn đã đúng sẵn). Một chú thích khẳng
  // định tính chất mà mã không có thì TỆ HƠN không có chú thích: người đọc sau
  // thôi không kiểm nữa. Nay @RequirePerm nhận NHIỀU mã và đòi ĐỦ CẢ, nên
  // "ghi-mà-không-đọc-được" là bất khả — kể cả khi ai đó cấp vai sai.
  // ScopeGuard chọn phạm vi HẸP NHẤT trong { wallet.repair, wallet.view } cho
  // route này (xem chú thích scope.guard.ts) — không phải rộng nhất, để một
  // vai chỉ cấp wallet.view=all + wallet.repair=own không thể SỬA sổ ví của
  // khách ngoài phạm vi own dù ĐỌC được (all).
  @Post(':cusId/repair-cache')
  @RequirePerm('wallet.repair', 'wallet.view')
  @ScopedBy({ entity: 'customer', param: 'cusId', field: 'code' })
  async repair(@Param('cusId') cusId: string) {
    const balance = await this.wallet.repairCache(cusId);
    return toWalletRepairDto(balance);
  }
}
