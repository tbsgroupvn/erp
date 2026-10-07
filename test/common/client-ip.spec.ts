import { clientIp } from '../../src/common/client-ip';

// clientIp() chỉ được tin X-Forwarded-For khi request đến TRỰC TIẾP từ một proxy
// mình cấu hình (TRUSTED_PROXIES). Không thì client tự gửi "X-Forwarded-For: 127.0.0.1"
// là qua mặt AuthService.isAllowedIp() (auth.service.ts:42) — xem task-2-brief.md.
describe('clientIp', () => {
  const ORIGINAL_TRUSTED_PROXIES = process.env.TRUSTED_PROXIES;
  afterEach(() => {
    if (ORIGINAL_TRUSTED_PROXIES === undefined) delete process.env.TRUSTED_PROXIES;
    else process.env.TRUSTED_PROXIES = ORIGINAL_TRUSTED_PROXIES;
  });

  it('KHÔNG tin X-Forwarded-For khi không cấu hình proxy tin cậy', () => {
    delete process.env.TRUSTED_PROXIES;
    expect(clientIp({ headers: { 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '1.2.3.4' } } as any))
      .toBe('1.2.3.4');
  });

  it('chỉ lấy XFF khi remoteAddress nằm trong TRUSTED_PROXIES', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.5' }, socket: { remoteAddress: '10.0.0.5' } } as any))
      .toBe('203.0.113.9');   // lấy HOP NGOÀI CÙNG BÊN TRÁI, không phải cuối
  });

  it('gỡ tiền tố IPv4-mapped IPv6 để isAllowedIp so khớp được', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::ffff:192.168.1.7' } } as any)).toBe('192.168.1.7');
  });

  it('XFF rỗng khi có proxy tin cậy vẫn rơi về remoteAddress', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({ headers: { 'x-forwarded-for': '' }, socket: { remoteAddress: '10.0.0.5' } } as any))
      .toBe('10.0.0.5');
  });

  it('XFF toàn khoảng trắng khi có proxy tin cậy vẫn rơi về remoteAddress', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({ headers: { 'x-forwarded-for': '   ' }, socket: { remoteAddress: '10.0.0.5' } } as any))
      .toBe('10.0.0.5');
  });

  it('XFF giả mạo từ nguồn KHÔNG PHẢI proxy tin cậy bị bỏ qua', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    // Kẻ tấn công kết nối thẳng (remoteAddress không nằm trong TRUSTED_PROXIES)
    // và tự đặt XFF để giả làm 127.0.0.1 — không được tin.
    expect(clientIp({ headers: { 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '9.9.9.9' } } as any))
      .toBe('9.9.9.9');
  });

  it('TRUSTED_PROXIES nhiều địa chỉ — khớp một trong số đó là đủ', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5, 10.0.0.6';
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.6' }, socket: { remoteAddress: '10.0.0.6' } } as any))
      .toBe('203.0.113.9');
  });

  it('so khớp TRUSTED_PROXIES sau khi chuẩn hoá ::ffff: trên remoteAddress', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, ::ffff:10.0.0.5' }, socket: { remoteAddress: '::ffff:10.0.0.5' } } as any))
      .toBe('203.0.113.9');
  });

  it('nhiều hop có khoảng trắng thừa vẫn cắt đúng hop ngoài cùng', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({ headers: { 'x-forwarded-for': '  203.0.113.9  ,  10.0.0.5  ' }, socket: { remoteAddress: '10.0.0.5' } } as any))
      .toBe('203.0.113.9');
  });

  it('không có header, không có socket — trả rỗng thay vì ném lỗi', () => {
    expect(clientIp({ headers: {} } as any)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F-1 của review CUỐI nhánh feat/api-dot1 — LẤY HOP TRÁI NHẤT LÀ LẤY NHẦM HOP.
//
// Bản Task 2 trả `hops[0]` (trái nhất) với lý do "ngữ nghĩa chuẩn: client,
// proxy1, proxy2...". Ngữ nghĩa đó ĐÚNG, nhưng nó giả định mọi hop bên trái
// đều do proxy ghi ra. Thực tế cấu hình Nginx phổ biến nhất —
// `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` (dạng NỐI
// THÊM, cũng là dạng DUY NHẤT sống sót qua hai tầng proxy) — NỐI địa chỉ nó
// thấy vào BÊN PHẢI chuỗi client tự gửi. Nên hop trái nhất là thứ KẺ TẤN CÔNG
// VIẾT, còn hop phải nhất-không-thuộc-proxy-tin-cậy mới là thứ HẠ TẦNG viết.
//
// Cách đúng (cũng là cách `proxy-addr` của Express — thứ mà main.ts vừa cấu
// hình qua 'trust proxy' — vẫn làm): duyệt từ PHẢI sang TRÁI, trả địa chỉ ĐẦU
// TIÊN KHÔNG nằm trong TRUSTED_PROXIES. Mọi hop đều tin cậy ⇒ rơi về
// socket.remoteAddress (giá trị KHÔNG GIẢ ĐƯỢC ở tầng ứng dụng).
// ═══════════════════════════════════════════════════════════════════════════
describe('clientIp — chọn hop KHÔNG GIẢ ĐƯỢC (F-1)', () => {
  const ORIGINAL = process.env.TRUSTED_PROXIES;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TRUSTED_PROXIES;
    else process.env.TRUSTED_PROXIES = ORIGINAL;
  });

  it('Nginx dạng NỐI THÊM: client tự xưng 127.0.0.1, proxy nối IP thật vào phải — '
    + 'phải lấy IP THẬT, không lấy lời tự xưng', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({
      headers: { 'x-forwarded-for': '127.0.0.1, 203.0.113.9' },
      socket: { remoteAddress: '10.0.0.5' },
    } as any)).toBe('203.0.113.9');
  });

  it('kẻ tấn công chèn NHIỀU hop giả: chỉ hop phải nhất (do proxy ghi) được tin', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(clientIp({
      headers: { 'x-forwarded-for': '127.0.0.1, 10.0.0.5, 203.0.113.9' },
      socket: { remoteAddress: '10.0.0.5' },
    } as any)).toBe('203.0.113.9');
  });

  it('chuỗi hai proxy tin cậy: bỏ qua CẢ HAI từ phải sang, lấy client thật', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5, 10.0.0.6';
    expect(clientIp({
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.5, 10.0.0.6' },
      socket: { remoteAddress: '10.0.0.6' },
    } as any)).toBe('203.0.113.9');
  });

  it('MỌI hop đều là proxy tin cậy -> rơi về socket peer, KHÔNG bịa ra một hop', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5, 10.0.0.6';
    expect(clientIp({
      headers: { 'x-forwarded-for': '10.0.0.5, 10.0.0.6' },
      socket: { remoteAddress: '10.0.0.5' },
    } as any)).toBe('10.0.0.5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I-1 (review cuối fix/auth-fidelity) — gateIp(): IP dùng cho CỔNG tài khoản chỉ-nội-bộ phải
// FAIL-CLOSED khi cấu hình proxy sai. Đứng sau reverse proxy CÙNG MÁY (aaPanel/nginx), socket peer
// luôn là 127.0.0.1:
//   (a) TRUSTED_PROXIES trống ⇒ clientIp() = 127.0.0.1 cho MỌI request ⇒ cổng loopback mở toang;
//   (b) TRUSTED_PROXIES=127.0.0.1 nhưng proxy không gửi X-Forwarded-For ⇒ cũng rơi về 127.0.0.1.
// gateIp() trả '' (= không biết ⇒ không cho qua) ở cả hai; clientIp() (dùng để GHI NHẬT KÝ) giữ nguyên.
// ═══════════════════════════════════════════════════════════════════════════
import { gateIp } from '../../src/common/client-ip';
describe('gateIp — fail-closed khi proxy cấu hình sai', () => {
  const ORIG = process.env.TRUSTED_PROXIES;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.TRUSTED_PROXIES;
    else process.env.TRUSTED_PROXIES = ORIG;
  });
  const req = (headers: Record<string, string>, remote = '127.0.0.1') => ({ headers, socket: { remoteAddress: remote } } as any);

  it.each([
    ['x-forwarded-for', '203.0.113.9'],
    ['x-real-ip', '203.0.113.9'],
    ['forwarded', 'for=203.0.113.9'],
  ])('(a) TRUSTED_PROXIES trống + peer loopback + header %s ⇒ "" (không phải 127.0.0.1)', (h, v) => {
    delete process.env.TRUSTED_PROXIES;
    expect(gateIp(req({ [h]: v }))).toBe('');
  });

  it('(a) cũng vậy khi TRUSTED_PROXIES=none (khai tường minh "không có proxy")', () => {
    process.env.TRUSTED_PROXIES = 'none';
    expect(gateIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('');
  });

  it('đối chứng (a): TRUSTED_PROXIES trống + peer loopback + KHÔNG header proxy ⇒ 127.0.0.1 (gọi cục bộ thật)', () => {
    delete process.env.TRUSTED_PROXIES;
    expect(gateIp(req({}))).toBe('127.0.0.1');
  });

  it('(b) TRUSTED_PROXIES=127.0.0.1 + peer là proxy + KHÔNG X-Forwarded-For ⇒ ""', () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    expect(gateIp(req({}))).toBe('');
  });

  it('(b) cũng vậy khi proxy chỉ gửi X-Real-IP (clientIp không đọc header đó)', () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    expect(gateIp(req({ 'x-real-ip': '127.0.0.1' }))).toBe('');
  });

  it('đối chứng proxy ĐÚNG: TRUSTED_PROXIES=127.0.0.1 + XFF client Internet ⇒ IP Internet', () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    expect(gateIp(req({ 'x-forwarded-for': '127.0.0.1, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('đối chứng proxy ĐÚNG: máy chủ tự gọi QUA proxy (XFF toàn hop tin cậy) ⇒ 127.0.0.1', () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    expect(gateIp(req({ 'x-forwarded-for': '127.0.0.1' }))).toBe('127.0.0.1');
  });

  // N-1 (re-review lượt sửa fix/auth-fidelity): TRUSTED_PROXIES CÓ khai nhưng KHÔNG chứa đúng địa
  // chỉ proxy thật ⇒ peer không nằm trong danh sách ⇒ clientIp() trả thẳng peer (loopback) ⇒ cổng
  // mở cho Internet. Có header proxy mà peer không phải proxy đã khai ⇒ phải "".
  it.each([
    ['127.0.0.1', '::1'], // khai IPv4, nginx nối qua IPv6
    ['::1', '127.0.0.1'], // ngược lại
    ['10.0.0.5', '127.0.0.1'], // khai nhầm IP khác
  ])('(c) TRUSTED_PROXIES=%s nhưng peer %s + XFF Internet ⇒ ""', (tp, peer) => {
    process.env.TRUSTED_PROXIES = tp;
    expect(gateIp(req({ 'x-forwarded-for': '203.0.113.9' }, peer))).toBe('');
  });

  it('(c) cũng vậy với X-Real-IP', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(gateIp(req({ 'x-real-ip': '203.0.113.9' }, '127.0.0.1'))).toBe('');
  });

  it('đối chứng (c): TRUSTED_PROXIES=10.0.0.5 + peer loopback KHÔNG header proxy ⇒ 127.0.0.1 (gọi cục bộ thật)', () => {
    process.env.TRUSTED_PROXIES = '10.0.0.5';
    expect(gateIp(req({}, '127.0.0.1'))).toBe('127.0.0.1');
  });

  it('clientIp() (ghi nhật ký) KHÔNG đổi hành vi ở cấu hình (a)', () => {
    delete process.env.TRUSTED_PROXIES;
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('127.0.0.1');
  });
});
