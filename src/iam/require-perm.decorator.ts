import { SetMetadata } from '@nestjs/common';
export const REQUIRE_PERM = 'require_perm';

/**
 * Gác một route (hoặc CẢ controller — PermGuard đọc metadata ở cả hai cấp, xem
 * F-4) bằng một hoặc NHIỀU mã quyền. Nhiều mã = đòi ĐỦ CẢ (AND), không phải
 * "có một trong số" (OR).
 *
 * ⚠ Vì sao AND chứ không OR: quyền ở hệ này là ALLOW-LIST, và ca dùng thật đầu
 * tiên (`wallet.repair` + `wallet.view`, Ruling 4 của review cuối nhánh
 * feat/api-dot1) cần đúng ngữ nghĩa "quyền ghi phải BAO HÀM quyền đọc". OR sẽ
 * làm mỗi mã thêm vào NỚI RỘNG cửa — tức càng khai nhiều càng hở, ngược hẳn
 * trực giác của người viết controller. Cần OR thì phải dựng một decorator khác
 * có TÊN nói rõ điều đó, đừng đổi ngữ nghĩa cái này.
 */
export const RequirePerm = (...perms: string[]) => SetMetadata(REQUIRE_PERM, perms);
