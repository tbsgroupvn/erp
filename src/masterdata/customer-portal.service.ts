import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../iam/auth.service';
import { PermService } from '../iam/perm.service';

// Mã quyền gác setPassword() — đặt/đổi mật khẩu cổng khách hàng thay họ là hành
// động nhạy cảm (chiếm quyền đăng nhập của KH), không phải thao tác đọc thường.
const PERM_SET_PASSWORD = 'customer.portal_manage';

// Đăng nhập CỔNG KHÁCH HÀNG — hệ định danh TÁCH BIỆT hoàn toàn khỏi User nội
// bộ (#01, tbl_user). Chỉ đọc/ghi tbl_customer (username/password riêng của
// Customer). KHÔNG đụng tbl_user — một username trùng ở 2 bảng KHÔNG được
// đăng nhập chéo hệ.
//
// Băm mật khẩu: TÁI DÙNG nguyên trạng AuthService.hash()/verify() (đọc
// src/iam/auth.service.ts) thay vì cài lại bcrypt ở đây — tránh bài học
// "bản sao logic không được vá theo" (2 nơi cùng logic, sửa 1 nơi quên nơi
// kia). Prod cũ băm mật khẩu KH bằng md5(sha512(...)) — yếu, KHÔNG tái tạo;
// mật khẩu mới luôn bcrypt qua AuthService.
@Injectable()
export class CustomerPortalService {
  constructor(private prisma: PrismaService, private auth: AuthService, private perm: PermService) {}

  // Hash "giả" cố định (tính 1 lần, cache lại) dùng để "trả giá" bcrypt.compare
  // ngay cả khi không tìm thấy KH / KH chưa từng đặt mật khẩu — chống dò
  // username qua thời gian phản hồi (timing side-channel), cùng kỹ thuật với
  // AuthService.DUMMY_HASH nhưng KHÔNG chép hằng số bcrypt: dùng lại
  // this.auth.hash() để sinh hash giả, không tự gọi bcrypt trực tiếp.
  private dummyHashPromise: Promise<string> | null = null;
  private dummyHash(): Promise<string> {
    if (!this.dummyHashPromise) this.dummyHashPromise = this.auth.hash('dummy-timing-normalizer-portal');
    return this.dummyHashPromise;
  }

  // `actorUid` là NGƯỜI GỌI (nhân viên nội bộ #01 thao tác hộ, ví dụ màn CSKH) —
  // KHÔNG phải khách hàng đang tự đổi mật khẩu của chính họ (luồng đó không đi qua
  // hàm này). Fail-closed: thiếu/actor không hợp lệ/không đủ quyền -> từ chối
  // NGAY, không chạm CSDL khách hàng (theo đúng mẫu SoD của
  // PermAdminService — đọc trước khi sửa: src/iam/perm-admin.service.ts).
  async setPassword(code: string, rawPassword: string, actorUid: number): Promise<{ ok: boolean; msg: string }> {
    const uid = Number(actorUid);
    if (!uid || uid <= 0 || !(await this.perm.can(PERM_SET_PASSWORD, uid))) {
      throw new ForbiddenException('Không có quyền đặt mật khẩu cổng khách hàng');
    }

    const c = (code ?? '').trim();
    if (!c) return { ok: false, msg: 'Thiếu mã khách hàng' };
    if (!rawPassword) return { ok: false, msg: 'Thiếu mật khẩu' };

    const hash = await this.auth.hash(rawPassword);
    const r = await this.prisma.customer.updateMany({ where: { code: c }, data: { password: hash } });
    if (r.count === 0) return { ok: false, msg: 'Không tìm thấy khách hàng ' + c };
    return { ok: true, msg: 'OK' };
  }

  async login(
    username: string,
    rawPassword: string,
  ): Promise<{ ok: boolean; customerId?: number; code?: string; msg: string }> {
    const uname = (username ?? '').trim();
    if (!uname || !rawPassword) return { ok: false, msg: 'Thiếu thông tin' };

    // CHỈ tra bảng Customer — tuyệt đối không đụng User (#01), giữ 2 hệ tách biệt.
    const c = await this.prisma.customer.findUnique({ where: { username: uname } });

    // Luôn trả giá bcrypt.compare (hash thật nếu KH tồn tại VÀ đã đặt mật khẩu,
    // hash giả cố định nếu không) để "không có KH" / "KH chưa đặt mật khẩu" /
    // "sai mật khẩu" mất thời gian tương đương — chống dò username.
    const hashToCheck = c?.password ?? (await this.dummyHash());
    const passOk = await this.auth.verify(rawPassword, hashToCheck);

    if (!c || !passOk) return { ok: false, msg: 'Sai tài khoản hoặc mật khẩu' };
    if (c.isactive === 0) return { ok: false, msg: 'Tài khoản đã bị khoá' };

    return { ok: true, customerId: c.id, code: c.code, msg: 'OK' };
  }
}
