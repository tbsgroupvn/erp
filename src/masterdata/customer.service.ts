import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerDto, toCustomerDto } from '../common/dto/customer.dto';
import { CustomerCodeService } from './customer-code.service';
import { ScopeService } from '../iam/scope.service';
import { AStatus } from '../approval/approval.constants';
import { nowSec, toVnd } from '../common/money';

/**
 * Hợp đồng giữa #02 (hạn mức khách) và #04 (engine duyệt).
 * Mẫu phiếu duyệt cấp hạn mức PHẢI dùng đúng `objectType` này và đúng tên
 * trường trong `form_data`, nếu không `applyCreditLimit` sẽ TỪ CHỐI (fail-closed).
 */
export const CREDIT_LIMIT_OBJECT_TYPE = 'credit_limit';
export const CREDIT_LIMIT_FIELD_CUS = 'cus';      // mã khách được cấp
export const CREDIT_LIMIT_FIELD_AMOUNT = 'han_muc'; // số tiền hạn mức (VND)

export type CreateCustomerInput = {
  name: string; phone?: string; email?: string; address?: string;
  taxCode?: string; groupCode?: string; saler?: string; source?: number;
};

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService, private code: CustomerCodeService, private scope: ScopeService) {}

  // Cùng cơ chế (Logger của @nestjs/common) với src/common/http-exception.filter.ts
  // — lỗi CSDL không lường trước phải LOG đủ ở server, KHÔNG trả nguyên .message
  // ra client (Fix round 2, sau Task 4).
  private readonly logger = new Logger(CustomerService.name);

  // Phạm vi xem theo #01 ScopeService — lọc trên saler/salerOther (tên trường
  // mặc định của buildDocScope trùng khớp Customer nên không cần truyền fields).
  // Fail-closed: quyền không khớp/không tồn tại -> where = {id:-1} -> rỗng, KHÔNG phải all.
  //
  // ⚠⚠ KIỂU TRẢ VỀ LÀ `CustomerDto[]`, KHÔNG PHẢI `Customer[]` (F-2 của review
  // cuối nhánh feat/api-dot1). Bản cũ trả model Prisma thô — gồm cả
  // `password` (hash bcrypt cổng khách hàng) — và tầng DTO của Task 3 viết ra
  // để bịt đúng chỗ này thì KHÔNG ĐƯỢC GỌI Ở ĐÂU.
  //
  // Vì sao chuyển đổi ở SERVICE chứ không ở controller: đặt ở controller thì
  // model thô vẫn LẤY RA ĐƯỢC từ service, nên mọi controller/consumer tương lai
  // phải TỰ NHỚ gọi `toCustomerDto` — đúng cái dạng "ai đó quên" mà F-2 sinh
  // ra. Đặt ở service thì rò rỉ là chuyện KHÔNG BIỂU DIỄN ĐƯỢC trong kiểu: không
  // có đường nào lấy được `Customer` thô ra khỏi lớp này, và tsc ép ở MỌI chỗ
  // gọi mà không cần ai nhớ gì.
  async listForUser(perm: string, uid: number): Promise<CustomerDto[]> {
    const where = await this.scope.buildDocScope(perm, uid);
    const rows = await this.prisma.customer.findMany({ where, orderBy: { id: 'desc' } });
    return rows.map((r) => toCustomerDto(r)!);
  }

  async create(input: CreateCustomerInput, by: string) {
    const name = (input.name ?? '').trim();
    if (!name) return { ok: false, msg: 'Thiếu tên khách hàng' };

    // Spec: người TẠO mặc định thành sale chính ("gán saler = người tạo") khi input
    // không truyền saler riêng. Nếu để saler=NULL, khách khớp KHÔNG scope own/team/
    // dept/dept_tree nào ở ScopeService ⇒ mồ côi vĩnh viễn — đúng cái setSalers() đã
    // từ chối ("Thiếu sale chính — khách không được mồ côi"), chỉ khác là create()
    // từng bỏ sót bất biến này. Cả saler lẫn by đều rỗng thì KHÔNG có ai để gán mặc
    // định ⇒ từ chối tạo luôn, nhất quán với setSalers(), thay vì âm thầm ghi NULL.
    const saler = (input.saler ?? '').trim() || (by ?? '').trim() || null;
    if (!saler) return { ok: false, msg: 'Thiếu sale chính — khách không được mồ côi' };

    // Sinh mã TRƯỚC khi ghi — prod làm ngược (ghi rồi mới UPDATE mã) nên từng
    // để lại khách KHÔNG CÓ MÃ khi bước UPDATE hỏng. Xem includes/customer_create.php:57-79.
    const code = await this.code.next();
    const now = nowSec();

    try {
      const cus = await this.prisma.$transaction(async (tx) => {
        const c = await tx.customer.create({
          data: {
            code, username: code, name,
            phone: (input.phone ?? '').trim() || null,
            email: (input.email ?? '').trim() || null,
            address: (input.address ?? '').trim() || null,
            taxCode: (input.taxCode ?? '').trim() || null,
            groupCode: (input.groupCode ?? '').trim() || null,
            saler,
            source: Number(input.source ?? 0) || 0,
            author: by, type: 1, isNew: 1, isactive: 1,
            cdate: now, mdate: now,
          },
        });
        // Ví phải sinh CÙNG transaction: thiếu ví thì mọi nạp/trừ của khách này
        // về sau đều hỏng (cảnh báo ở đầu includes/customer_create.php).
        await tx.wallet.create({ data: { cusId: code, total: 0n, status: 1 } });
        return c;
      });
      return { ok: true, msg: 'OK', id: cus.id, code: cus.code };
    } catch (e: any) {
      // Lỗi KHÔNG lường trước (Prisma/Postgres thật) — .message có thể mang tên
      // bảng/cột/constraint/đường dẫn file. KHÔNG nối .message vào response
      // (Fix round 2) — log đủ ở server, trả người gọi một câu ổn định.
      this.logger.error('create: ' + (e?.message ?? String(e)), e?.stack);
      return { ok: false, msg: 'Không tạo được khách hàng — vui lòng thử lại hoặc liên hệ IT' };
    }
  }

  // Chuyển sale chính/phụ — không được để KH mồ côi (sale chính trống) và
  // không được ghi "[]" cho salerOther rỗng (tránh phép LIKE của ScopeService
  // khớp nhầm rác). salerOther luôn ghi đúng format JSON mảng của prod.
  async setSalers(code: string, salerPrimary: string, salersOther: string[], by: string) {
    const primary = (salerPrimary ?? '').trim();
    if (!primary) return { ok: false, msg: 'Thiếu sale chính — khách không được mồ côi' };

    const others = Array.from(new Set((salersOther ?? []).map((s) => (s ?? '').trim()).filter(Boolean)))
      .filter((s) => s !== primary); // sale chính không lặp ở phụ

    const r = await this.prisma.customer.updateMany({
      where: { code },
      data: {
        saler: primary,
        salerOther: others.length ? JSON.stringify(others) : null,
        editBy: by,
        mdate: nowSec(),
      },
    });
    if (r.count === 0) return { ok: false, msg: 'Không tìm thấy khách ' + code };
    return { ok: true, msg: 'OK' };
  }

  // Hạn mức tín dụng CHỈ đặt qua phiếu duyệt đã duyệt (#04) — không có đường
  // set thẳng cho sale/KT. Tách quyền: KTT đề xuất, BGĐ duyệt (ngoài phạm vi
  // task này — nền cho #04). Prod hiện credit_limit=0 toàn bộ 1.944 khách.
  async applyCreditLimit(code: string, limitVnd: bigint | number, days: number,
                         approvedBy: string, opts: { approvedRequestId: number }) {
    if (!opts?.approvedRequestId || opts.approvedRequestId <= 0)
      return { ok: false, msg: 'Hạn mức chỉ được đặt qua phiếu duyệt đã duyệt' };
    // Guard NGUYÊN ĐỒNG trước khi toVnd() — toVnd() quy tròn qua Number(),
    // nếu để nó chạy trước sẽ ÂM THẦM làm tròn 1_000_000.5 thay vì từ chối.
    if (typeof limitVnd === 'number' && !Number.isInteger(limitVnd))
      return { ok: false, msg: 'Hạn mức phải nguyên đồng' };
    const limit = toVnd(limitVnd);
    if (limit < 0n) return { ok: false, msg: 'Hạn mức không được âm' };

    // ⚠⚠ KIỂM PHIẾU DUYỆT THẬT (23/09/2026). Trước đây chỗ này chỉ kiểm
    // `approvedRequestId > 0` — tức TIN LỜI người gọi. Nguyên văn review:
    // "invariant 6 hiện là honour-system". Chỉ kiểm "có tồn tại một phiếu đã
    // duyệt nào đó" cũng CHƯA đủ: có thể trỏ vào một phiếu đã duyệt BẤT KỲ
    // (vd phiếu chi vặt) để đặt hạn mức tuỳ ý. Nên phải khớp ĐỦ BỐN:
    //   (1) phiếu tồn tại và chưa bị xoá
    //   (2) trạng thái ĐÃ DUYỆT (#04 AStatus.APPROVED) — không phải chờ/từ chối/thu hồi
    //   (3) ĐÚNG LOẠI phiếu cấp hạn mức
    //   (4) form_data khớp ĐÚNG khách này và ĐÚNG số tiền đang áp
    // Thiếu bất kỳ điều nào ⇒ TỪ CHỐI (fail-closed). Đây là chốt SoD: KT
    // trưởng đề xuất, BGĐ duyệt — sale/KT không tự đặt được.
    const req = await this.prisma.approvalRequest.findUnique({
      where: { id: opts.approvedRequestId },
    });
    if (!req || req.isDeleted) return { ok: false, msg: 'Không tìm thấy phiếu duyệt hạn mức' };
    if (req.status !== AStatus.APPROVED) return { ok: false, msg: 'Phiếu duyệt chưa được duyệt' };
    if (req.objectType !== CREDIT_LIMIT_OBJECT_TYPE)
      return { ok: false, msg: 'Phiếu duyệt không phải loại cấp hạn mức' };

    let fd: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(req.formData ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) fd = parsed;
    } catch {
      return { ok: false, msg: 'Dữ liệu phiếu duyệt hỏng' };
    }
    if (String(fd[CREDIT_LIMIT_FIELD_CUS] ?? '').trim() !== code)
      return { ok: false, msg: 'Phiếu duyệt cấp cho khách khác' };
    const approvedAmount = fd[CREDIT_LIMIT_FIELD_AMOUNT];
    if (approvedAmount === undefined || approvedAmount === null || approvedAmount === '')
      return { ok: false, msg: 'Phiếu duyệt thiếu số tiền hạn mức' };
    if (toVnd(approvedAmount as number | string) !== limit)
      return { ok: false, msg: 'Số tiền không khớp phiếu duyệt' };

    const r = await this.prisma.customer.updateMany({
      where: { code },
      data: {
        creditLimit: limit,
        creditDays: Math.max(0, Number(days) || 0),
        creditAt: nowSec(),
        creditBy: approvedBy,
        mdate: nowSec(),
      },
    });
    if (r.count === 0) return { ok: false, msg: 'Không tìm thấy khách ' + code };
    return { ok: true, msg: 'OK' };
  }
}
