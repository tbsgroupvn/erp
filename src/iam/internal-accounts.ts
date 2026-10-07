/**
 * D3 (docs/rewrite-spec/migration/01-iam.md) — TÀI KHOẢN CHỈ ĐĂNG NHẬP ĐƯỢC TỪ CHÍNH MÁY CHỦ.
 *
 * Chép đúng prod `libs/cls.users.php` (sql_nhpcn, đọc 24/09/2026):
 *   - `tbs_tk_chi_noi_bo()`  — danh sách TƯỜNG MINH, khai trong MÃ (prod không để ở bảng/cấu hình);
 *   - `tbs_tk_duoc_phep_tu_dia_chi_nay()` — chỉ cho REMOTE_ADDR loopback
 *     (`127.0.0.1` / `::1` / `::ffff:127.0.0.1`) hoặc REMOTE_ADDR == SERVER_ADDR (khác rỗng).
 *
 * Vì sao có chốt này (ghi chú prod 03/09/2026): các tài khoản test/bot dưới đây là người duyệt hợp lệ
 * của nhiều mẫu phiếu, vài cái ở nhóm Super Admin; mật khẩu nằm trong tài liệu dự án và `ZZQA_admin`
 * ĐÃ từng đăng nhập từ IP Internet.
 *
 * ⚠ BẢN CŨ CỦA HỆ MỚI (tới 24/09/2026) sai ở CẢ HAI vế: chỉ nhận diện `/^ZZ/i` (bỏ lọt
 * `tbs.assistant.ai` = siêu quản trị, `qa_goods`/`admin_test` = vai quản trị) và cho qua `10.*`,
 * `192.168.*`, `103.142.27.*` (dải /24 của NHÀ CUNG CẤP HOSTING, không phải mạng nội bộ).
 *
 * Hai chỗ hệ mới CHẶT HƠN prod, có chủ ý:
 *  1. So KHÔNG phân biệt hoa-thường. Prod so `in_array($user, $ds, true)` (phân biệt hoa-thường)
 *     trong khi câu SQL tra user lại KHÔNG phân biệt (collation `utf8mb3_unicode_ci`) ⇒ trên prod gõ
 *     `zzqa_admin` là LỌT cổng mà vẫn khớp tài khoản `ZZQA_admin`. Hệ mới tra tên không phân biệt
 *     hoa-thường (D4) nên cổng BẮT BUỘC cũng phải vậy, nếu không là tái lập đúng lỗ đó.
 *  2. Giữ thêm vế tiền tố `ZZ` (mọi hoa-thường) của bản cũ. Prod 24/09/2026: 9 tài khoản `zz%`, cả 9
 *     đều nằm trong danh sách ⇒ vế này không chặn thêm người thật nào; nó giữ nguyên hàng rào cho
 *     tài khoản thử `ZZ*` sinh ra sau này (regression prod tạo `ZZREG_*`/`ZZQA_*`).
 */
export const TAI_KHOAN_CHI_NOI_BO: readonly string[] = Object.freeze([
  'tbs.assistant.ai', 'qa_goods', 'admin_test', 'ZZQA_admin',
  'ZZQA_ketoan', 'ZZQA_xnk', 'ZZQA_hcns', 'ZZQA_kho', 'ZZQA_khovn48', 'ZZQA_khotq', 'ZZQA_sale', 'ZZQA_saleadmin',
]);

const DS_THUONG = new Set(TAI_KHOAN_CHI_NOI_BO.map((s) => s.toLowerCase()));

export function isInternalOnly(username: string): boolean {
  const k = (username ?? '').toLowerCase();
  return k.startsWith('zz') || DS_THUONG.has(k);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Request có xuất phát từ CHÍNH máy chủ không. `ip` = IP client (đã qua `clientIp()`), `serverIp` =
 * địa chỉ cục bộ của kết nối (`req.socket.localAddress`, tương đương SERVER_ADDR của Apache).
 * Thiếu một trong hai ⇒ KHÔNG cho qua (prod: CLI có SERVER_ADDR rỗng cũng không được mặc nhiên qua).
 */
export function isFromServerItself(ip?: string, serverIp?: string): boolean {
  const a = ip ?? '';
  if (LOOPBACK.has(a)) return true;
  const s = serverIp ?? '';
  return a !== '' && s !== '' && a === s;
}
