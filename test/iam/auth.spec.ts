import { prisma, resetIam } from '../helpers/iam-db';
import { AuthService } from '../../src/iam/auth.service';
import * as bcrypt from 'bcrypt';
const auth = new AuthService(prisma as any);
beforeEach(resetIam); afterAll(() => prisma.$disconnect());
async function mkUser(username: string, pw: string, active = true) {
  return prisma.user.create({ data: { username, password: await bcrypt.hash(pw, 10), isActive: active } });
}
test('valid login logs dang_nhap + updates lastLogin', async () => {
  const u = await mkUser('sale1', 'secret');
  const r = await auth.login('sale1', 'secret', { ip: '1.2.3.4' });
  // (24/09/2026, D7) thêm `username` ĐÃ LƯU vào kết quả — khẳng định CHẶT hơn, không nới.
  expect(r).toEqual({ ok: true, userId: u.id, username: 'sale1' });
  expect(await prisma.loginLog.count({ where: { loai: 'dang_nhap', username: 'sale1' } })).toBe(1);
  expect((await prisma.user.findUnique({ where: { id: u.id } }))!.lastLogin).not.toBeNull();
});
test('wrong password logs sai_mat_khau, no session', async () => {
  await mkUser('sale1', 'secret');
  const r = await auth.login('sale1', 'nope', {});
  expect(r.ok).toBe(false);
  expect(await prisma.loginLog.count({ where: { loai: 'sai_mat_khau', username: 'sale1' } })).toBe(1);
});
test('inactive user cannot login', async () => {
  await mkUser('sale1', 'secret', false);
  expect((await auth.login('sale1', 'secret', {})).ok).toBe(false);
});
// (M-5) Tên cũ "…before password check" đã SAI: từ D3 cổng quyết định SAU lượt bcrypt có chủ ý
// (chống dò thời gian, xem khối D3). Chỉ đổi tên, khẳng định giữ nguyên.
test('internal-only (ZZ) user blocked from non-allowed ip', async () => {
  await mkUser('ZZQA_1', 'secret');
  const r = await auth.login('ZZQA_1', 'secret', { ip: '8.8.8.8' });
  expect(r.ok).toBe(false);
  // (24/09/2026, D3) Trước đây ca này còn khẳng định `reason` khớp /nội bộ/. Đó
  // chính là chỗ lộ: lý do chặn phải GIỐNG HỆT sai mật khẩu — xem khối D3 bên dưới
  // ('lý do bị chặn giống hệt lý do sai mật khẩu'), khẳng định CHẶT hơn thay thế.
});

// ═══════════════════════════════════════════════════════════════════════════
// D3 (migration/01-iam.md) — cổng tài khoản chỉ-nội-bộ chép đúng prod
// (`libs/cls.users.php` tbs_tk_chi_noi_bo() + tbs_tk_duoc_phep_tu_dia_chi_nay()):
// danh sách TƯỜNG MINH 12 tài khoản, chỉ cho loopback hoặc ĐỊA CHỈ CHÍNH MÁY CHỦ.
// Bản cũ nhận cả 10.* / 192.168.* / 103.142.27.* (dải /24 của nhà cung cấp hosting)
// và chỉ nhận diện /^ZZ/ ⇒ qa_goods / admin_test (vai quản trị) / tbs.assistant.ai
// (siêu quản trị) đăng nhập được từ Internet.
// ═══════════════════════════════════════════════════════════════════════════
describe('D3 — tài khoản chỉ-nội-bộ', () => {
  const INTERNET = '203.0.113.9';
  const DS = ['tbs.assistant.ai', 'qa_goods', 'admin_test', 'ZZQA_admin'];

  it.each(DS)('%s từ IP Internet ⇒ bị chặn', async (name) => {
    await mkUser(name, 'secret');
    expect((await auth.login(name, 'secret', { ip: INTERNET })).ok).toBe(false);
  });

  // ĐỐI CHỨNG: cùng tài khoản, cùng mật khẩu, từ loopback ⇒ vào được. Chứng minh ca
  // trên đỏ vì CỔNG, không phải vì fixture/mật khẩu.
  it.each(DS)('đối chứng: %s từ 127.0.0.1 ⇒ vào được', async (name) => {
    await mkUser(name, 'secret');
    expect((await auth.login(name, 'secret', { ip: '127.0.0.1' })).ok).toBe(true);
  });

  it.each(['::1', '::ffff:127.0.0.1'])('loopback dạng %s ⇒ vào được (như prod)', async (ip) => {
    await mkUser('qa_goods', 'secret');
    expect((await auth.login('qa_goods', 'secret', { ip })).ok).toBe(true);
  });

  it.each(['10.1.2.3', '192.168.1.5', '103.142.27.200', '127.0.0.2'])(
    'dải cũ %s KHÔNG còn được coi là nội bộ', async (ip) => {
      await mkUser('ZZQA_admin', 'secret');
      expect((await auth.login('ZZQA_admin', 'secret', { ip })).ok).toBe(false);
    });

  it('IP trùng ĐỊA CHỈ CHÍNH MÁY CHỦ (REMOTE_ADDR == SERVER_ADDR) ⇒ vào được', async () => {
    await mkUser('admin_test', 'secret');
    expect((await auth.login('admin_test', 'secret', { ip: '198.51.100.7', serverIp: '198.51.100.7' })).ok).toBe(true);
  });

  it('đối chứng: địa chỉ máy chủ KHÁC IP client ⇒ bị chặn', async () => {
    await mkUser('admin_test', 'secret');
    expect((await auth.login('admin_test', 'secret', { ip: '198.51.100.7', serverIp: '198.51.100.8' })).ok).toBe(false);
  });

  it('không biết IP (rỗng) ⇒ bị chặn (fail-closed, dù serverIp cũng rỗng)', async () => {
    await mkUser('admin_test', 'secret');
    expect((await auth.login('admin_test', 'secret', { ip: '', serverIp: '' })).ok).toBe(false);
  });

  it('đối chứng: tài khoản THƯỜNG từ IP Internet KHÔNG bị cổng này chặn', async () => {
    await mkUser('sale1', 'secret');
    expect((await auth.login('sale1', 'secret', { ip: INTERNET })).ok).toBe(true);
  });

  it('lý do bị chặn giống hệt lý do sai mật khẩu (không lộ "tài khoản nội bộ")', async () => {
    await mkUser('qa_goods', 'secret');
    await mkUser('sale1', 'secret');
    const blocked = await auth.login('qa_goods', 'secret', { ip: INTERNET });
    const wrong = await auth.login('sale1', 'sai', { ip: INTERNET });
    expect((blocked as any).reason).toBe((wrong as any).reason);
  });

  // Chống dò bằng THỜI GIAN: nhánh bị chặn phải trả đúng một lượt bcrypt như nhánh
  // sai mật khẩu. Bản cũ return SỚM (không bcrypt) ⇒ phản hồi nhanh hẳn = lộ ra đây
  // là tài khoản nội bộ.
  it('nhánh bị chặn vẫn trả giá bcrypt đúng MỘT lần như sai mật khẩu', async () => {
    await mkUser('ZZQA_admin', 'secret');
    const spy = jest.spyOn(auth, 'verify');
    try {
      await auth.login('ZZQA_admin', 'secret', { ip: INTERNET });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('nhánh bị chặn ghi sai_mat_khau như prod ($flag=false)', async () => {
    await mkUser('qa_goods', 'secret');
    await auth.login('qa_goods', 'secret', { ip: INTERNET });
    expect(await prisma.loginLog.count({ where: { loai: 'sai_mat_khau', username: 'qa_goods' } })).toBe(1);
  });
});
test('recentFailCount counts 24h fails', async () => {
  await mkUser('sale1', 'secret');
  await auth.login('sale1', 'x', {}); await auth.login('sale1', 'y', {});
  expect(await auth.recentFailCount('sale1')).toBe(2);
});
test('rehash-on-login upgrades a low-rounds hash', async () => {
  const u = await prisma.user.create({ data: { username: 'sale1', password: await bcrypt.hash('secret', 6), isActive: true } });
  const r = await auth.login('sale1', 'secret', {});
  expect(r.ok).toBe(true);
  const after = (await prisma.user.findUnique({ where: { id: u.id } }))!.password;
  expect(after).not.toBe(u.password);
  expect(bcrypt.getRounds(after)).toBe(10);
});
test('non-existent username returns ok:false without throwing (dummy-hash path)', async () => {
  const r = await auth.login('nosuchuser', 'whatever', {});
  expect(r.ok).toBe(false);
});

// ═══════════════════════════════════════════════════════════════════════════
// F-6 của review CUỐI nhánh feat/api-dot1 — `recentFailCount()` LÀ MÃ CHẾT.
//
// Hàm đếm 24h `sai_mat_khau` được viết và được test (ca ngay trên), nhưng
// KHÔNG CHỖ NÀO TRONG src/ GỌI NÓ. `POST /auth/login` là cửa duy nhất vào hệ
// thống, @Public(), không giới hạn tần suất, không khoá. Và
// auth.controller.ts còn chú thích về một nhánh "khoá tài khoản" mà
// AuthService.login() không hề có — tài liệu mô tả một chốt chặn không tồn tại.
//
// Nay đã nối: quá ngưỡng thì TỪ CHỐI kể cả mật khẩu ĐÚNG.
// ═══════════════════════════════════════════════════════════════════════════
describe('khoá tạm sau nhiều lần sai (F-6)', () => {
  const ORIGINAL = process.env.LOGIN_MAX_FAIL_24H;
  beforeEach(() => { process.env.LOGIN_MAX_FAIL_24H = '3'; });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.LOGIN_MAX_FAIL_24H;
    else process.env.LOGIN_MAX_FAIL_24H = ORIGINAL;
  });

  it('đủ ngưỡng lần sai -> mật khẩu ĐÚNG cũng bị từ chối', async () => {
    await mkUser('sale1', 'secret');
    for (let i = 0; i < 3; i++) await auth.login('sale1', 'sai' + i, {});
    expect((await auth.login('sale1', 'secret', {})).ok).toBe(false);
  });

  // ĐỐI CHỨNG: chứng minh ca trên đỏ vì KHOÁ, không phải vì mật khẩu/fixture hỏng.
  it('đối chứng: DƯỚI ngưỡng một lần thì mật khẩu đúng vẫn vào được', async () => {
    await mkUser('sale1', 'secret');
    for (let i = 0; i < 2; i++) await auth.login('sale1', 'sai' + i, {});
    expect((await auth.login('sale1', 'secret', {})).ok).toBe(true);
  });

  it('lần bị khoá ghi loại `tai_khoan_khoa` (KHÔNG cộng thêm sai_mat_khau — '
    + 'nếu cộng thì khoá tự gia hạn vô hạn mỗi lần bị thử)', async () => {
    await mkUser('sale1', 'secret');
    for (let i = 0; i < 3; i++) await auth.login('sale1', 'sai' + i, {});
    await auth.login('sale1', 'secret', {});
    expect(await prisma.loginLog.count({ where: { loai: 'sai_mat_khau', username: 'sale1' } })).toBe(3);
  });

  it('lần bị khoá CÓ để lại vết kiểm toán riêng', async () => {
    await mkUser('sale1', 'secret');
    for (let i = 0; i < 3; i++) await auth.login('sale1', 'sai' + i, {});
    await auth.login('sale1', 'secret', {});
    expect(await prisma.loginLog.count({ where: { loai: 'tai_khoan_khoa', username: 'sale1' } })).toBe(1);
  });

  it('chỉ đếm lần sai TRONG 24h — bản ghi cũ hơn không khoá được tài khoản', async () => {
    const u = await mkUser('sale1', 'secret');
    const old = Math.floor(Date.now() / 1000) - 90000; // > 24h
    for (let i = 0; i < 5; i++) {
      await prisma.loginLog.create({ data: { userId: u.id, username: 'sale1', loai: 'sai_mat_khau', cdate: old } });
    }
    expect((await auth.login('sale1', 'secret', {})).ok).toBe(true);
  });
});

describe('D3 — danh sách khớp prod tbs_tk_chi_noi_bo()', () => {
  it('đúng 12 tên, đúng thứ tự, đúng chữ như prod (libs/cls.users.php, HEAD 2e21930)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TAI_KHOAN_CHI_NOI_BO } = require('../../src/iam/internal-accounts');
    expect(TAI_KHOAN_CHI_NOI_BO).toEqual([
      'tbs.assistant.ai', 'qa_goods', 'admin_test', 'ZZQA_admin',
      'ZZQA_ketoan', 'ZZQA_xnk', 'ZZQA_hcns', 'ZZQA_kho', 'ZZQA_khovn48', 'ZZQA_khotq', 'ZZQA_sale', 'ZZQA_saleadmin',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D1 (migration/01-iam.md) — hash `$2y$` của PHP password_hash(). bcrypt@6 (native) trả FALSE cho
// tiền tố `$2y$` dù thuật toán y hệt `$2b$` ⇒ prod 85/96 hash là `$2y$` ⇒ 0/87 người đang bật đăng
// nhập được hệ mới. Sửa: chuẩn hoá tiền tố LÚC SO, không đổi dữ liệu đã lưu.
// ═══════════════════════════════════════════════════════════════════════════
describe('D1 — hash $2y$ của PHP', () => {
  const to2y = (h: string) => '$2y$' + h.slice(4);
  // Vector công khai trong tài liệu PHP (password_verify / crypt) — hash do PHP sinh thật.
  const PHP_DOC_HASH = '$2y$07$BCryptRequires22Chrcte/VlQH0piJtjXl.0t1XkA8pw9dMXTpOq';

  it('verify: vector PHP chuẩn $2y$ + đúng mật khẩu ⇒ true', async () => {
    expect(await auth.verify('rasmuslerdorf', PHP_DOC_HASH)).toBe(true);
  });

  it('đối chứng: vector PHP chuẩn $2y$ + SAI mật khẩu ⇒ false', async () => {
    expect(await auth.verify('rasmuslerdorF', PHP_DOC_HASH)).toBe(false);
  });

  it('login: user mang hash $2y$ + đúng mật khẩu ⇒ vào được', async () => {
    await prisma.user.create({ data: { username: 'sale2y', password: to2y(await bcrypt.hash('secret', 10)), isActive: true } });
    expect((await auth.login('sale2y', 'secret', {})).ok).toBe(true);
  });

  it('đối chứng: user mang hash $2y$ + SAI mật khẩu ⇒ không vào', async () => {
    await prisma.user.create({ data: { username: 'sale2y', password: to2y(await bcrypt.hash('secret', 10)), isActive: true } });
    expect((await auth.login('sale2y', 'Secret', {})).ok).toBe(false);
  });

  it('login $2y$ thành công KHÔNG ghi lại hash đã lưu (không đổi dữ liệu)', async () => {
    const stored = to2y(await bcrypt.hash('secret', 10));
    const u = await prisma.user.create({ data: { username: 'sale2y', password: stored, isActive: true } });
    await auth.login('sale2y', 'secret', {});
    expect((await prisma.user.findUnique({ where: { id: u.id } }))!.password).toBe(stored);
  });

  it('user không tồn tại vẫn trả giá bcrypt đúng MỘT lần (chống dò thời gian)', async () => {
    const spy = jest.spyOn(auth, 'verify');
    try {
      await auth.login('nosuchuser', 'whatever', {});
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D2 (migration/01-iam.md) — hash CŨ md5(hash('sha512', pw)) (32 hex thường). Prod 11/96 dòng, 5
// người đang bật; prod `includes/pw.php` tbs_pw_verify() có nhánh này + tbs_pw_needs_rehash() nâng
// lên bcrypt ngay khi đăng nhập đúng. Hệ mới thiếu ⇒ 5 người không bao giờ vào được (rồi bị khoá).
// ═══════════════════════════════════════════════════════════════════════════
describe('D2 — hash cũ md5(sha512)', () => {
  // Sinh bằng CHÍNH includes/pw.php của prod (HEAD 2e21930) chạy ở máy local:
  //   md5(hash('sha512', 'Mật khẩu@1'))  ⇒ tbs_pw_verify(...) === true. Mật khẩu tự đặt, không phải dữ liệu prod.
  const PW = 'Mật khẩu@1';
  const LEGACY = '32f9a6aa88888bfecaae4eae3e93b398';
  const mkLegacy = (username = 'nganha_x') =>
    prisma.user.create({ data: { username, password: LEGACY, isActive: true } });
  const storedOf = async (id: number) => (await prisma.user.findUnique({ where: { id } }))!.password;

  it('đúng mật khẩu ⇒ vào được', async () => {
    await mkLegacy();
    expect((await auth.login('nganha_x', PW, {})).ok).toBe(true);
  });

  it('đối chứng: sai mật khẩu ⇒ không vào', async () => {
    await mkLegacy();
    expect((await auth.login('nganha_x', 'Mật khẩu@2', {})).ok).toBe(false);
  });

  it('đăng nhập đúng ⇒ hash được BĂM LẠI sang bcrypt ngay (không giữ md5)', async () => {
    const u = await mkLegacy();
    await auth.login('nganha_x', PW, {});
    expect((await storedOf(u.id)).startsWith('$2b$10$')).toBe(true);
  });

  it('hash bcrypt mới khớp đúng mật khẩu cũ', async () => {
    const u = await mkLegacy();
    await auth.login('nganha_x', PW, {});
    expect(await bcrypt.compare(PW, await storedOf(u.id))).toBe(true);
  });

  it('đối chứng: sai mật khẩu ⇒ hash md5 giữ nguyên', async () => {
    const u = await mkLegacy();
    await auth.login('nganha_x', 'Mật khẩu@2', {});
    expect(await storedOf(u.id)).toBe(LEGACY);
  });

  it('so CHÍNH XÁC như hash_equals của prod: hex HOA ⇒ false', async () => {
    await prisma.user.create({ data: { username: 'nganha_x', password: LEGACY.toUpperCase(), isActive: true } });
    expect((await auth.login('nganha_x', PW, {})).ok).toBe(false);
  });

  it('hash rỗng ⇒ false (prod: $stored==="" ⇒ false)', async () => {
    await prisma.user.create({ data: { username: 'nganha_x', password: '', isActive: true } });
    expect((await auth.login('nganha_x', 'x', {})).ok).toBe(false);
  });

  // md5 rẻ hơn bcrypt hàng nghìn lần: không trả giá bcrypt thì user mang hash cũ trả lời NHANH hơn
  // hẳn ⇒ thời gian phản hồi lộ ra "tài khoản này tồn tại và mang hash cũ".
  it('nhánh hash cũ vẫn trả giá bcrypt đúng MỘT lần', async () => {
    await mkLegacy();
    const spy = jest.spyOn(auth, 'verify');
    try {
      await auth.login('nganha_x', 'Mật khẩu@2', {});
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('tài khoản nội bộ mang hash cũ, đúng mật khẩu nhưng BỊ CHẶN IP ⇒ KHÔNG băm lại', async () => {
    const u = await mkLegacy('tbs.assistant.ai');
    await auth.login('tbs.assistant.ai', PW, { ip: '203.0.113.9' });
    expect(await storedOf(u.id)).toBe(LEGACY);
  });

  it('đối chứng: cùng tài khoản từ loopback ⇒ vào được và được băm lại', async () => {
    const u = await mkLegacy('tbs.assistant.ai');
    await auth.login('tbs.assistant.ai', PW, { ip: '127.0.0.1' });
    expect((await storedOf(u.id)).startsWith('$2b$')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D4 + D7 (migration/01-iam.md) — prod tra `username` bằng collation utf8mb3_unicode_ci (KHÔNG phân
// biệt hoa-thường); 270 lượt đăng nhập thành công/30 ngày gõ khác chữ hoa. Và danh tính trả ra (JWT,
// submitted_by, saler…) phải là username ĐÃ LƯU, không phải chuỗi người dùng gõ.
// ═══════════════════════════════════════════════════════════════════════════
describe('D4 + D7 — tên đăng nhập không phân biệt hoa-thường, trả tên ĐÃ LƯU', () => {
  it("gõ 'lephuc' ⇒ vào được tài khoản 'LePhuc'", async () => {
    await mkUser('LePhuc', 'secret');
    expect((await auth.login('lephuc', 'secret', {})).ok).toBe(true);
  });

  it("kết quả mang username ĐÃ LƯU 'LePhuc', không phải chữ gõ", async () => {
    await mkUser('LePhuc', 'secret');
    expect((await auth.login('LEPHUC', 'secret', {}) as any).username).toBe('LePhuc');
  });

  it("đối chứng: 'lephuc' + SAI mật khẩu ⇒ không vào", async () => {
    await mkUser('LePhuc', 'secret');
    expect((await auth.login('lephuc', 'Secret', {})).ok).toBe(false);
  });

  // Prisma `mode: 'insensitive'` dịch sang ILIKE ⇒ `_` / `%` trong chữ gõ thành KÝ TỰ ĐẠI DIỆN.
  it("'_' trong chữ gõ KHÔNG phải ký tự đại diện: gõ 'sale_a' không vào 'saleXa'", async () => {
    await mkUser('saleXa', 'secret');
    expect((await auth.login('sale_a', 'secret', {})).ok).toBe(false);
  });

  it("'%' trong chữ gõ KHÔNG phải ký tự đại diện", async () => {
    await mkUser('sale1', 'secret');
    expect((await auth.login('sal%', 'secret', {})).ok).toBe(false);
  });

  it('người dùng đã tắt vẫn không vào được dù gõ khác hoa-thường', async () => {
    await mkUser('LePhuc', 'secret', false);
    expect((await auth.login('lephuc', 'secret', {})).ok).toBe(false);
  });

  // Cổng nội bộ không được lọt bằng cách đổi chữ hoa (trên prod `in_array(...,true)` phân biệt
  // hoa-thường còn SQL thì không ⇒ `zzqa_admin` LỌT cổng prod).
  it("'QA_Goods' từ IP Internet ⇒ bị chặn", async () => {
    await mkUser('qa_goods', 'secret');
    expect((await auth.login('QA_Goods', 'secret', { ip: '203.0.113.9' })).ok).toBe(false);
  });

  it("đối chứng: 'QA_Goods' từ loopback ⇒ vào được", async () => {
    await mkUser('qa_goods', 'secret');
    expect((await auth.login('QA_Goods', 'secret', { ip: '127.0.0.1' })).ok).toBe(true);
  });

  describe('khoá tạm đếm KHÔNG phân biệt hoa-thường', () => {
    const ORIGINAL = process.env.LOGIN_MAX_FAIL_24H;
    beforeEach(() => { process.env.LOGIN_MAX_FAIL_24H = '3'; });
    afterEach(() => {
      if (ORIGINAL === undefined) delete process.env.LOGIN_MAX_FAIL_24H;
      else process.env.LOGIN_MAX_FAIL_24H = ORIGINAL;
    });

    // Không vậy thì mỗi biến thể chữ hoa được một hạn mức riêng ⇒ ngưỡng khoá nhân lên 2^n lần.
    it('3 lần sai gõ sale1 / SALE1 / Sale1 ⇒ mật khẩu đúng cũng bị từ chối', async () => {
      await mkUser('sale1', 'secret');
      for (const v of ['sale1', 'SALE1', 'Sale1']) await auth.login(v, 'sai', {});
      expect((await auth.login('sAlE1', 'secret', {})).ok).toBe(false);
    });

    it('đối chứng: 2 lần sai (biến thể chữ) ⇒ mật khẩu đúng vẫn vào', async () => {
      await mkUser('sale1', 'secret');
      for (const v of ['SALE1', 'Sale1']) await auth.login(v, 'sai', {});
      expect((await auth.login('sAlE1', 'secret', {})).ok).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C-1 (review cuối fix/auth-fidelity) — cổng nội bộ phải xét TÀI KHOẢN TÌM ĐƯỢC, không chỉ chữ gõ.
// Chữ gõ được chuẩn hoá ở HAI nơi khác nhau: JS `toLowerCase()` (cổng) và Postgres `lower()` (tra
// user, glibc). Hai bên lệch nhau ở U+0130 'İ': JS ⇒ "i̇" (i + dấu chấm kết hợp), glibc ⇒ "i". Gõ
// `tbs.assİstant.aİ` từng: cổng nói "không nội bộ", tra user lại ra `tbs.assistant.ai` (siêu quản trị)
// ⇒ đăng nhập được từ Internet. Tên ĐÃ LƯU là nguồn sự thật.
// ═══════════════════════════════════════════════════════════════════════════
describe('C-1 — cổng nội bộ xét username ĐÃ LƯU của tài khoản tìm được', () => {
  const INTERNET = '203.0.113.9';

  it.each([['tbs.assistant.ai', 'tbs.assİstant.aİ'], ['admin_test', 'admİn_test']])(
    '%s gõ thành %s từ IP Internet ⇒ bị chặn', async (stored, typed) => {
      await mkUser(stored, 'secret');
      expect((await auth.login(typed, 'secret', { ip: INTERNET })).ok).toBe(false);
    });

  // ĐỐI CHỨNG: chứng minh biến thể chữ THẬT SỰ tra ra đúng tài khoản (nếu không thì ca trên xanh
  // chỉ vì "không có user", chẳng chứng minh gì về cổng).
  it.each([['tbs.assistant.ai', 'tbs.assİstant.aİ'], ['admin_test', 'admİn_test']])(
    'đối chứng: %s gõ thành %s từ loopback ⇒ vào được, mang tên đã lưu', async (stored, typed) => {
      await mkUser(stored, 'secret');
      expect((await auth.login(typed, 'secret', { ip: '127.0.0.1' }) as any).username).toBe(stored);
    });

  // Tổng quát: MỌI cách viết tra ra một tài khoản nội bộ đều bị chặn từ Internet — không phụ thuộc
  // cách chuẩn hoá nào của chữ gõ. Biến thể: chữ HOA, trộn hoa-thường, dấu cách hai đầu, 'İ' thay
  // mọi 'i'. Mỗi biến thể có ĐỐI CHỨNG loopback ở khối dưới.
  const { TAI_KHOAN_CHI_NOI_BO } = require('../../src/iam/internal-accounts');
  const variants = (n: string) => [
    n.toUpperCase(),
    n.split('').map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(''),
    `  ${n}  `,
    n.replace(/i/gi, 'İ'),
  ];
  const CASES: [string, string][] = (TAI_KHOAN_CHI_NOI_BO as string[])
    .flatMap((n) => variants(n).map((v) => [n, v] as [string, string]))
    .filter(([n, v]) => v !== n);

  it.each(CASES)('%s viết thành %j từ IP Internet ⇒ bị chặn', async (stored, typed) => {
    await mkUser(stored, 'secret');
    expect((await auth.login(typed, 'secret', { ip: INTERNET })).ok).toBe(false);
  });

  it.each(CASES)('đối chứng: %s viết thành %j từ loopback ⇒ vào đúng tài khoản', async (stored, typed) => {
    await mkUser(stored, 'secret');
    expect((await auth.login(typed, 'secret', { ip: '127.0.0.1' }) as any).username).toBe(stored);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M-1 (review cuối fix/auth-fidelity) — user CÓ THẬT tốn 2 lượt CSDL ($queryRaw rồi findUnique),
// user KHÔNG có tốn 1 ⇒ chênh một vòng CSDL đo được = kênh dò tài khoản. Đếm số lệnh CSDL chạy
// TRƯỚC lượt bcrypt: hai nhánh phải bằng nhau.
// ═══════════════════════════════════════════════════════════════════════════
describe('M-1 — số lượt CSDL trước bcrypt không lộ user có tồn tại', () => {
  function counted() {
    let n = 0;
    const wrap = (obj: any) => new Proxy(obj, { get: (t, k) => {
      const v = t[k];
      return typeof v === 'function' ? (...a: any[]) => { n++; return v.apply(t, a); } : v;
    } });
    const p = new Proxy(prisma as any, { get: (t, k) => {
      const v = t[k];
      if (typeof k === 'string' && k.startsWith('$') && typeof v === 'function') return (...a: any[]) => { n++; return v.apply(t, a); };
      if (v && typeof v === 'object' && typeof v.findUnique === 'function') return wrap(v);
      return v;
    } });
    const svc = new AuthService(p);
    let atBcrypt = -1;
    const orig = svc.verify.bind(svc);
    jest.spyOn(svc, 'verify').mockImplementation(async (a: string, b: string) => {
      if (atBcrypt < 0) atBcrypt = n;
      return orig(a, b);
    });
    return { svc, atBcrypt: () => atBcrypt };
  }

  it('user có thật và user không tồn tại chạy CÙNG số lệnh CSDL trước bcrypt', async () => {
    await mkUser('sale1', 'secret');
    const a = counted(); await a.svc.login('sale1', 'sai', {});
    const b = counted(); await b.svc.login('khongco', 'sai', {});
    expect(a.atBcrypt()).toBe(b.atBcrypt());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M-2 (review cuối fix/auth-fidelity) — rehash-on-login ghi ĐÈ vô điều kiện `where {id}`. Nếu mật
// khẩu bị đặt lại trong lúc lượt đăng nhập đang bay, lượt đó ghi đè bằng bcrypt của MẬT KHẨU CŨ ⇒
// mật khẩu cũ sống lại. Ghi có điều kiện trên hash cũ.
// ═══════════════════════════════════════════════════════════════════════════
describe('M-2 — rehash không ghi đè mật khẩu vừa được đặt lại', () => {
  const LEGACY = '32f9a6aa88888bfecaae4eae3e93b398'; // md5(sha512('Mật khẩu@1')), xem khối D2

  it('mật khẩu bị đặt lại GIỮA lượt đăng nhập ⇒ hash mới đặt lại được giữ nguyên', async () => {
    const u = await prisma.user.create({ data: { username: 'nganha_x', password: LEGACY, isActive: true } });
    const reset = await bcrypt.hash('MatKhauMoi@9', 4);
    const svc = new AuthService(prisma as any);
    const origHash = svc.hash.bind(svc);
    // Đặt lại mật khẩu đúng lúc lượt đăng nhập đang tính hash mới (sau verify, trước khi ghi).
    jest.spyOn(svc, 'hash').mockImplementation(async (pw: string) => {
      await prisma.user.update({ where: { id: u.id }, data: { password: reset } });
      return origHash(pw);
    });
    await svc.login('nganha_x', 'Mật khẩu@1', {});
    expect((await prisma.user.findUnique({ where: { id: u.id } }))!.password).toBe(reset);
  });

  it('đối chứng: không ai đặt lại ⇒ vẫn được băm lại sang bcrypt', async () => {
    const u = await prisma.user.create({ data: { username: 'nganha_x', password: LEGACY, isActive: true } });
    await new AuthService(prisma as any).login('nganha_x', 'Mật khẩu@1', {});
    expect((await prisma.user.findUnique({ where: { id: u.id } }))!.password.startsWith('$2b$10$')).toBe(true);
  });
});
