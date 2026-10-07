// Node/Express báo IPv4 cục bộ dạng IPv4-mapped IPv6 ("::ffff:127.0.0.1") khi server
// nghe dual-stack. isFromServerItself() (src/iam/internal-accounts.ts) so khớp CHUỖI ĐÚNG '127.0.0.1'/'::1' —
// không chuẩn hoá thì mọi request loopback thật (kể cả regression/tests nội bộ) bị
// coi là "ngoài" và tài khoản ZZ-prefixed bị chặn oan. Không sửa auth.service.ts
// (cấm), nên chuẩn hoá ở đây trước khi truyền ip vào. ÁP DỤNG cho CẢ remoteAddress
// (để so khớp TRUSTED_PROXIES) lẫn hop XFF lấy ra cuối cùng.
export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

// Đọc lại process.env MỖI LẦN gọi (không cache ở module-load) — test set
// process.env.TRUSTED_PROXIES giữa các ca, và cấu hình có thể đổi lúc runtime.
// `none` = khai TƯỜNG MINH "Node nhận thẳng từ Internet, không có proxy" (I-1: production bắt buộc
// khai biến này, xem src/main.ts) ⇒ coi như danh sách rỗng.
export function trustedProxies(): string[] {
  const raw = process.env.TRUSTED_PROXIES;
  if (!raw) return [];
  return raw.split(',').map((s) => normalizeIp(s.trim())).filter((s) => s && s.toLowerCase() !== 'none');
}

/**
 * Lấy IP thật của client.
 *
 * ⚠⚠ X-Forwarded-For là header CLIENT TỰ ĐẶT ĐƯỢC — tin thẳng nó (bản Task 1 làm vậy)
 * nghĩa là ai cũng tự xưng "127.0.0.1" và qua mặt isFromServerItself() (src/iam/internal-accounts.ts) (chặn tài
 * khoản nội bộ đăng nhập từ ngoài). Chỉ tin XFF khi request đến
 * TRỰC TIẾP từ một địa chỉ nằm trong TRUSTED_PROXIES (đọc từ env, phân tách bằng dấu
 * phẩy) — tức `socket.remoteAddress` (địa chỉ TCP thật, không giả được ở tầng ứng
 * dụng) khớp danh sách đó. Không cấu hình TRUSTED_PROXIES ⇒ bỏ qua XFF hoàn toàn.
 *
 * Khi được tin, duyệt XFF từ PHẢI sang TRÁI và trả địa chỉ ĐẦU TIÊN KHÔNG nằm trong
 * TRUSTED_PROXIES.
 *
 * ⚠⚠ VÌ SAO KHÔNG LẤY HOP TRÁI NHẤT (sửa 23/09/2026 — F-1 của review cuối nhánh
 * feat/api-dot1; bản Task 2 lấy `hops[0]`). Ngữ nghĩa chuẩn của XFF đúng là
 * "client, proxy1, proxy2, …", nhưng nó chỉ đúng KHI MỌI HOP đều do hạ tầng ghi.
 * Cấu hình Nginx phổ biến nhất — `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for`, cũng là dạng DUY NHẤT sống sót qua hai tầng proxy —
 * NỐI THÊM địa chỉ nó thấy vào BÊN PHẢI chuỗi mà client tự gửi. Nghĩa là:
 *   - hop TRÁI NHẤT  = thứ KẺ TẤN CÔNG viết (gửi `X-Forwarded-For: 127.0.0.1` là đủ)
 *   - hop PHẢI NHẤT không-thuộc-proxy-tin-cậy = thứ HẠ TẦNG viết
 * Tin hop trái nhất là tái lập NGUYÊN VẸN lỗ hổng mà Task 2 sinh ra để bịt: tự xưng
 * `127.0.0.1` qua mặt `isFromServerItself() (src/iam/internal-accounts.ts)` (auth.service.ts:42). Đây cũng
 * đúng cách `proxy-addr` của Express (thứ `src/main.ts` cấu hình qua 'trust proxy')
 * vẫn làm — trước đây hàm này cài LẠI nó theo hướng không an toàn.
 *
 * ⚠ GIỚI HẠN CÒN LẠI (ghi thẳng, KHÔNG ngụ ý là đã giải quyết xong):
 * 1. Cách này xác định đúng địa chỉ mà PROXY TIN CẬY NGOÀI CÙNG nhìn thấy. Nếu giữa
 *    proxy đó và client còn một proxy KHÔNG khai báo (CDN, load-balancer của nhà
 *    mạng…), giá trị trả về là địa chỉ của proxy ẩn đó, không phải người dùng cuối.
 *    Không có cách nào ở tầng ứng dụng phân biệt được — phải khai ĐỦ chuỗi proxy vào
 *    TRUSTED_PROXIES.
 * 2. TRUSTED_PROXIES nhận ĐỊA CHỈ ĐƠN LẺ, chưa hỗ trợ dải CIDR. Hạ tầng nhiều proxy
 *    động phải liệt kê từng IP.
 * 3. KHÔNG cấu hình TRUSTED_PROXIES ⇒ XFF bị BỎ QUA HOÀN TOÀN, luôn trả socket peer.
 *    Đó là lựa chọn CÓ CHỦ Ý: khi chưa biết topo, thà lấy giá trị KHÔNG GIẢ ĐƯỢC
 *    (địa chỉ TCP thật) còn hơn giá trị client tự khai. Hệ quả phải biết: đặt Node
 *    sau một reverse proxy CÙNG MÁY mà quên đặt TRUSTED_PROXIES thì MỌI request
 *    resolve ra `127.0.0.1` — `isFromServerItself()` coi là nội bộ ⇒ cổng chặn tài khoản
 *    ZZ* từ ngoài thành vô hiệu, và toàn bộ `tbl_login_log` ghi một địa chỉ duy
 *    nhất. `src/main.ts` phát CẢNH BÁO lúc khởi động đúng vì tình huống này; nó
 *    KHÔNG tự phát hiện được có proxy hay không.
 *
 * Không có type import Express ở đây để tránh kéo thêm dependency — tham số chỉ cần
 * đọc `.headers`, `.ip`, `.socket.remoteAddress`.
 */
export function clientIp(req: any): string {
  const remote = normalizeIp(req?.socket?.remoteAddress || req?.ip || '');
  const proxies = trustedProxies();
  if (proxies.length && proxies.includes(remote)) {
    const xff = req?.headers?.['x-forwarded-for'];
    if (typeof xff === 'string') {
      const hops = xff.split(',').map((s) => normalizeIp(s.trim())).filter(Boolean);
      // Từ PHẢI sang TRÁI: hop đầu tiên không phải proxy đã khai tin cậy.
      for (let i = hops.length - 1; i >= 0; i--) {
        if (!proxies.includes(hops[i])) return hops[i];
      }
      // Mọi hop đều là proxy tin cậy (hoặc XFF rỗng) -> không có gì để tin thêm,
      // rơi về địa chỉ TCP thật thay vì bịa ra một hop.
    }
  }
  return remote;
}

/**
 * I-1 (review cuối fix/auth-fidelity) — IP dùng cho CỔNG tài khoản chỉ-nội-bộ
 * (src/iam/internal-accounts.ts isFromServerItself). Khác clientIp() (dùng GHI NHẬT KÝ) ở chỗ
 * FAIL-CLOSED: trả '' (= không biết ⇒ không cho qua) khi không xác định được client thật:
 *
 *  (a) TRUSTED_PROXIES trống nhưng request mang header proxy (X-Forwarded-For / X-Real-IP /
 *      Forwarded) — dấu hiệu có reverse proxy đứng trước mà chưa khai. Sau nginx CÙNG MÁY, socket
 *      peer là 127.0.0.1 cho MỌI request ⇒ clientIp() = 127.0.0.1 ⇒ cổng loopback mở cho cả Internet.
 *  (b) peer là proxy tin cậy nhưng KHÔNG gửi X-Forwarded-For — proxy không cho biết client là ai,
 *      clientIp() rơi về địa chỉ proxy (127.0.0.1).
 *
 * Còn lại như clientIp(). XFF mà MỌI hop đều là proxy tin cậy ⇒ địa chỉ proxy: đó là máy chủ tự gọi
 * vòng qua proxy (nginx nối `$remote_addr` = 127.0.0.1), được coi là nội bộ như prod.
 *
 * ⚠ GIỚI HẠN còn lại: proxy KHÔNG gửi header nào cả mà TRUSTED_PROXIES trống thì request trông y hệt
 * gọi cục bộ thật — tầng ứng dụng không phân biệt được. Vì thế production TỪ CHỐI KHỞI ĐỘNG khi thiếu
 * TRUSTED_PROXIES (src/main.ts), buộc người triển khai khai topo tường minh.
 */
export function gateIp(req: any): string {
  const h = req?.headers ?? {};
  const hasProxyHeader = ['x-forwarded-for', 'x-real-ip', 'forwarded'].some((k) => h[k] !== undefined);
  const proxies = trustedProxies();
  const remote = normalizeIp(req?.socket?.remoteAddress || req?.ip || '');
  // (a) + (c) N-1: có header proxy mà peer KHÔNG phải proxy đã khai (danh sách trống, hoặc khai
  // lệch — vd khai 127.0.0.1 nhưng nginx nối qua ::1) ⇒ clientIp() sẽ trả thẳng peer (loopback)
  // ⇒ không biết client thật ⇒ "".
  if (hasProxyHeader && !proxies.includes(remote)) return '';
  if (proxies.includes(remote)) {
    const xff = h['x-forwarded-for'];
    if (typeof xff !== 'string' || !xff.split(',').some((x) => x.trim())) return '';
  }
  return clientIp(req);
}
