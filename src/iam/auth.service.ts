import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isInternalOnly, isFromServerItself } from './internal-accounts';

const ROUNDS = 10;
// Hash cố định (tính một lần khi nạp module) dùng để "trả giá" bcrypt.compare ngay cả khi
// user không tồn tại — chống dò username qua thời gian phản hồi (timing side-channel).
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-normalizer', ROUNDS);
// Lý do DUY NHẤT cho mọi nhánh "sai" (sai mật khẩu, không có user, bị chặn tài khoản nội bộ) —
// để kể cả khi `reason` lọt ra ngoài cũng không phân biệt được nhánh nào.
const SAI = 'Sai tài khoản hoặc mật khẩu';

/**
 * D2 — hash CŨ của prod: `md5(hash('sha512', $plain))` (32 hex thường), `includes/pw.php`
 * tbs_pw_verify(): chuỗi lưu KHÔNG bắt đầu bằng '$' ⇒ `hash_equals($stored, md5(hash('sha512',$plain)))`.
 * So chính xác từng byte như hash_equals (hex HOA ⇒ false), thời gian hằng.
 */
function legacyMatches(pw: string, stored: string): boolean {
  const sha = createHash('sha512').update(pw, 'utf8').digest('hex');
  const calc = Buffer.from(createHash('md5').update(sha, 'utf8').digest('hex'), 'utf8');
  const st = Buffer.from(stored, 'utf8');
  return st.length === calc.length && timingSafeEqual(st, calc);
}
function isLegacy(stored: string): boolean { return stored !== '' && stored[0] !== '$'; }

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async hash(pw: string) { return bcrypt.hash(pw, ROUNDS); }
  /**
   * D1 — `$2y$` là tiền tố PHP password_hash() dùng cho CÙNG thuật toán bcrypt với `$2b$`, nhưng
   * bcrypt@6 (native) trả false cho `$2y$` ⇒ prod 85/96 hash không khớp được. Chuẩn hoá tiền tố LÚC
   * SO; dữ liệu đã lưu giữ nguyên (không rehash chỉ vì tiền tố).
   */
  async verify(pw: string, hash: string) {
    const h = typeof hash === 'string' && hash.startsWith('$2y$') ? '$2b$' + hash.slice(4) : hash;
    try { return await bcrypt.compare(pw, h); } catch { return false; }
  }

  /**
   * So mật khẩu với hash ĐÃ LƯU của `tbl_user`, mọi định dạng prod có: bcrypt (`$2y$`/`$2b$`) và
   * hash cũ md5(sha512). LUÔN trả đúng MỘT lượt bcrypt (`verify`) dù định dạng nào — nhánh md5 rẻ
   * hơn hàng nghìn lần, không trả giá thì thời gian phản hồi lộ ra "tài khoản này mang hash cũ".
   */
  private async verifyStored(pw: string, stored: string): Promise<boolean> {
    if (typeof stored !== 'string' || stored === '') { await this.verify(pw, DUMMY_HASH); return false; }
    // ⚠ M-3 (review cuối, CHƯA SỬA — ghi lại có chủ ý): mọi chuỗi bắt đầu bằng '$' đều đi bcrypt. Prod
    // password_verify() còn nhận argon2 (`$argon2…`) — hash đó ở hệ mới luôn ra false (không ném).
    // Prod 24/09/2026: 0 dòng như vậy (85 `$2y$` + 11 md5). Có dòng thì phải thêm nhánh.
    if (!isLegacy(stored)) return this.verify(pw, stored);
    await this.verify(pw, DUMMY_HASH);
    return legacyMatches(pw, stored);
  }

  /** Như prod tbs_pw_needs_rehash(): hash cũ ⇒ luôn nâng; bcrypt cost thấp hơn ROUNDS ⇒ nâng. */
  private needsRehash(stored: string): boolean {
    if (isLegacy(stored)) return true;
    try { return bcrypt.getRounds(stored) < ROUNDS; } catch { return false; }
  }

  /**
   * Ngưỡng khoá tạm: số lần `sai_mat_khau` trong 24h làm tài khoản bị TỪ CHỐI
   * kể cả khi nhập đúng mật khẩu. Đọc env MỖI LẦN gọi để test đổi được.
   *
   * ⚠ ĐÁNH ĐỔI PHẢI BIẾT: khoá theo USERNAME nên kẻ xấu cố tình nhập sai có thể
   * KHOÁ OAN người dùng thật (DoS nhắm mục tiêu). Đây là bản chất của mọi cơ chế
   * khoá theo tài khoản; lời giải đúng là giới hạn tần suất theo IP + username
   * (@nestjs/throttler) để phần lớn lưu lượng rác bị chặn TRƯỚC khi chạm bộ đếm
   * này. Bộ giới hạn đó nằm NGOÀI phạm vi đợt sửa này (review ghi rõ) — nhưng
   * "chưa có phanh hoàn chỉnh" không phải lý do để bộ phanh ĐÃ VIẾT SẴN nằm chết.
   */
  private maxFail24h(): number {
    const n = Number(process.env.LOGIN_MAX_FAIL_24H ?? 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  /**
   * Đếm KHÔNG phân biệt hoa-thường (D4): tên đăng nhập khớp không phân biệt hoa-thường thì bộ đếm
   * khoá cũng phải vậy, nếu không mỗi biến thể chữ hoa (`sale1`/`SALE1`/`Sale1`…) có một hạn mức
   * riêng ⇒ ngưỡng khoá bị nhân lên. `lower() = lower()` chứ KHÔNG dùng `mode: 'insensitive'` của
   * Prisma (ILIKE ⇒ `_`/`%` trong chữ gõ thành ký tự đại diện).
   */
  async recentFailCount(username: string): Promise<number> {
    const since = Math.floor(Date.now() / 1000) - 86400;
    const r = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM tbl_login_log
      WHERE lower(username) = lower(${username}) AND loai = 'sai_mat_khau' AND cdate >= ${since}`;
    return Number(r[0]?.n ?? 0);
  }

  /**
   * D4 — prod tra `WHERE username='$user' AND isactive=1` với collation utf8mb3_unicode_ci: KHÔNG phân
   * biệt hoa-thường. Tra bằng `lower() = lower()` (KHÔNG ILIKE — xem recentFailCount). Nhiều hơn một
   * dòng khớp (chỉ có thể xảy ra nếu thiếu chỉ mục UNIQUE lower(username)) ⇒ coi như không có user:
   * thà từ chối còn hơn đăng nhập nhầm vào tài khoản người khác.
   */
  //
  // M-1: MỘT truy vấn lấy đủ cột cần dùng — bản trước tra id rồi findUnique (2 vòng CSDL cho user có
  // thật, 1 vòng cho user không có ⇒ chênh thời gian đo được = kênh dò tài khoản).
  private async findActiveUser(username: string): Promise<{ id: number; username: string; password: string } | null> {
    const rows = await this.prisma.$queryRaw<{ id: number; username: string; password: string }[]>`
      SELECT id, username, password FROM tbl_user
      WHERE lower(username) = lower(${username}) AND is_active = true LIMIT 2`;
    return rows.length === 1 ? rows[0] : null;
  }

  private async writeLog(userId: number | null, username: string, loai: string, ctx: any) {
    try {
      await this.prisma.loginLog.create({ data: {
        userId: userId ?? null, username: username.slice(0, 50), loai,
        ip: (ctx.ip ?? '').slice(0, 45), userAgent: (ctx.userAgent ?? '').slice(0, 400),
        referer: (ctx.referer ?? '').slice(0, 300), cdate: Math.floor(Date.now() / 1000),
      }});
    } catch { /* nuốt: log hỏng không chặn đăng nhập */ }
  }

  async login(username: string, password: string, ctx: { ip?: string; gateIp?: string; serverIp?: string; userAgent?: string; referer?: string }) {
    username = (username ?? '').replace(/['"]/g, '').trim();
    if (!username || !password) return { ok: false as const, reason: 'Thiếu thông tin' };
    // D3 — chốt tài khoản chỉ-nội-bộ (xem src/iam/internal-accounts.ts). QUYẾT ĐỊNH ở đây nhưng
    // KHÔNG return sớm: prod đặt $flag=false rồi VẪN tra user + so mật khẩu. Return sớm (bản cũ)
    // bỏ qua bcrypt ⇒ phản hồi nhanh hẳn ⇒ thời gian phản hồi lộ ra "đây là tài khoản nội bộ".
    //
    // ⚠⚠ C-1: xét CẢ username ĐÃ LƯU của tài khoản tìm được, không chỉ chữ gõ. Chữ gõ được chuẩn hoá
    // ở hai nơi khác nhau — JS toLowerCase() (cổng) và Postgres lower() (tra user) — và chúng LỆCH
    // nhau (U+0130 'İ': JS ⇒ "i̇", glibc ⇒ "i") ⇒ gõ `tbs.assİstant.aİ` từng lọt cổng mà vẫn vào siêu
    // quản trị. Tên đã lưu là nguồn sự thật; vế chữ gõ giữ lại để tài khoản KHÔNG tồn tại/đã tắt cũng
    // đi đúng nhánh như nhau.
    // I-1: `gateIp` (fail-closed, src/common/client-ip.ts) khi controller truyền; `ip` chỉ để ghi nhật ký.
    const fromServer = isFromServerItself(ctx.gateIp ?? ctx.ip, ctx.serverIp);
    // ĐẾM TRƯỚC khi tra mật khẩu, nhưng QUYẾT ĐỊNH SAU (xem dưới) — đếm ở đây để
    // MỌI lần đăng nhập đều trả cùng một lượt truy vấn, khỏi lộ trạng thái khoá
    // qua thời gian phản hồi.
    const failCount = await this.recentFailCount(username);

    const u = await this.findActiveUser(username);
    const blockedInternal = !fromServer && (isInternalOnly(username) || (u != null && isInternalOnly(u.username)));
    // Luôn trả giá bcrypt.compare (hash thật nếu có user, hash giả nếu không) để "không tìm thấy
    // user" và "sai mật khẩu" mất thời gian tương đương — chống dò username qua timing.
    const passwordOk = await this.verifyStored(password, u ? u.password : DUMMY_HASH);

    // ⚠⚠ CHỐT KHOÁ TẠM (F-6) — đặt SAU bcrypt.compare CÓ CHỦ Ý. Đặt trước thì
    // tài khoản đang bị khoá trả lời NHANH hơn hẳn (bỏ qua bcrypt cost 10) ⇒
    // chính trạng thái khoá trở thành kênh dò: kẻ tấn công đo thời gian là biết
    // username nào tồn tại và đang bị thử. Trả giá bcrypt xong rồi mới từ chối.
    //
    // Ghi loại RIÊNG `tai_khoan_khoa`, KHÔNG ghi thêm `sai_mat_khau`: nếu ghi
    // sai_mat_khau thì mỗi lần thử lại tự gia hạn khoá ⇒ khoá vĩnh viễn. Nay
    // khoá hết hiệu lực 24h sau lần sai THỨ N, không phải sau lần thử cuối.
    //
    // `reason` dưới đây PHÂN BIỆT được nhánh, nên auth.controller.ts KHÔNG trả
    // nó ra ngoài — mọi nhánh hỏng dùng chung một câu. Xem chú thích ở đó.
    if (failCount >= this.maxFail24h()) {
      await this.writeLog(u?.id ?? null, username, 'tai_khoan_khoa', ctx);
      return { ok: false as const, reason: 'Tài khoản tạm khoá do đăng nhập sai nhiều lần' };
    }

    // Bị chặn nội bộ đi CHUNG nhánh với sai mật khẩu: cùng loại nhật ký (prod ghi 'sai_mat_khau'
    // khi $flag=false), cùng lý do, và KHÔNG rehash (không để lại dấu vết "mật khẩu đúng").
    if (!u || !passwordOk || blockedInternal) {
      await this.writeLog(u?.id ?? null, username, 'sai_mat_khau', ctx);
      return { ok: false as const, reason: SAI };
    }
    // rehash-on-login: hash cũ md5(sha512) (D2) hoặc bcrypt cost thấp ⇒ băm lại NGAY bằng bcrypt.
    // Chỉ ở nhánh THÀNH CÔNG (không ở nhánh bị chặn nội bộ). `$2y$` cost 10 KHÔNG bị ghi lại (D1).
    // M-2: ghi CÓ ĐIỀU KIỆN trên hash vừa kiểm — mật khẩu bị đặt lại trong lúc lượt này đang bay thì
    // 0 dòng khớp, KHÔNG ghi đè bằng bcrypt của mật khẩu cũ.
    try {
      if (this.needsRehash(u.password)) {
        const fresh = await this.hash(password);
        await this.prisma.user.updateMany({ where: { id: u.id, password: u.password }, data: { password: fresh } });
      }
    } catch { /* ghi hỏng: lần sau thử lại */ }
    await this.prisma.user.update({ where: { id: u.id }, data: { lastLogin: new Date() } });
    await this.writeLog(u.id, username, 'dang_nhap', ctx);
    // D7 — trả username ĐÃ LƯU (không phải chữ gõ): JWT và mọi khoá nối submitted_by/saler/người
    // duyệt dựa vào nó. Nhật ký đăng nhập ở trên vẫn ghi chữ gõ, như prod ghi `$user`.
    return { ok: true as const, userId: u.id, username: u.username };
  }
}
