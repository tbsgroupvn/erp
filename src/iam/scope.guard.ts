import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPED_BY, ScopedByEntity, ScopedByOptions } from './scoped-by.decorator';
import { REQUIRE_PERM } from './require-perm.decorator';
import { ScopeService } from './scope.service';
import { PermService } from './perm.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseIntId } from '../common/int-id';

/** Một dòng của bảng tra entity trong ScopeGuard. */
type EntityCfg = {
  delegate: { findFirst: (args: any) => Promise<unknown> };
  /** Tham số route (chuỗi) -> giá trị cột; `null` = không thể là khoá ⇒ 404. */
  parse: (v: string) => string | number | null;
  /** Cột chủ sở hữu cho buildDocScope; bỏ trống = mặc định (khớp Customer). */
  docFields?: { saler?: string; salerOther?: string | null; warehouse?: string | null };
  /**
   * Entity KHÔNG có chủ sở hữu (không cột saler/kho) — chỉ phạm vi `all` mới thấy; mọi phạm vi
   * hẹp hơn ⇒ DENY (fail-closed), KHÔNG gọi buildDocScope (nó sẽ dựng vế trên cột không tồn tại).
   */
  allOnly?: boolean;
};

/**
 * Task 1 của kế hoạch "@RequirePerm nhận biết PHẠM VI"
 * (.superpowers/sdd/2026-09-24-perm-scope-plan/task-1-brief.md) — xem
 * scoped-by.decorator.ts để biết LỖ đang đóng.
 *
 * CHẠY SAU PermGuard (thứ tự đăng ký APP_GUARD trong auth.module.ts): tới
 * lúc này request đã vượt qua "có quyền gọi route", câu hỏi còn lại là "bản
 * ghi ứng với tham số route có nằm trong phạm vi của user hay không".
 *
 * ⚠⚠ MỘT lỗi, MỘT truy vấn — đọc kỹ trước khi sửa. Mục tiêu là chặn
 * ENUMERATION, không chỉ che số dư. Nếu "khách không tồn tại" trả 404 còn
 * "khách tồn tại nhưng ngoài phạm vi" trả 403 (hoặc bất kỳ lỗi nào KHÁC),
 * kẻ tấn công vẫn dò được mã nào CÓ THẬT — chỉ đổi thứ rò rỉ từ SỐ DƯ sang
 * SỰ TỒN TẠI, không bịt lỗ. Vì vậy:
 *  - CẢ HAI nhánh ném ĐÚNG MỘT `NotFoundException` với CÙNG message.
 *  - Cả hai đi qua MỘT truy vấn `findFirst({ where: { AND: [{field:value},
 *    scope] } })` — KHÔNG tách "tìm bản ghi rồi kiểm scope riêng": hai truy
 *    vấn cho hai nhánh là một kênh THỜI GIAN lộ ra đúng điều status/body đã
 *    cố giấu (bản ghi tồn tại thì có thêm một lượt so khớp scope, đo được).
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private scope: ScopeService,
    private permSvc: PermService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<ScopedByOptions | undefined>(SCOPED_BY, [ctx.getHandler(), ctx.getClass()]);
    if (!meta) return true; // không khai @ScopedBy — bỏ qua; PermGuard vẫn gác riêng, đây KHÔNG phải một lỗ
    // Opt-out CÓ CHỦ ĐÍCH (Task 2, xem scoped-by.decorator.ts) — `reason` khác
    // rỗng là điều kiện do route-inventory.spec.ts ép ở build-time, ScopeGuard
    // không lặp lại kiểm tra đó ở runtime, chỉ tin vào quyết định đã khai.
    // ⚠ `=== true`, KHÔNG phải `'none' in meta` (D-7 review cuối nhánh): lưới
    // route-inventory.spec.ts đọc field này bằng `none === true`, nên metadata
    // viết tay `{ none:false, entity, param, field }` từng BỎ QUA guard lúc
    // chạy trong khi lưới vẫn đọc nó như một scope thật và cho xanh. Hai tầng
    // đọc CÙNG một field theo hai luật khác nhau = chỗ để lọt.
    if ('none' in meta && meta.none === true) return true;

    const req = ctx.switchToHttp().getRequest();
    const uid = Number(req.user?.sub);
    if (!uid || uid <= 0) return false; // fail-closed: có @ScopedBy mà không có danh tính đã xác thực

    // Mã quyền của ĐÚNG handler đang chạy (không phải lớp) — đối xứng với cách
    // PermGuard đọc REQUIRE_PERM, để buildDocScope dùng ĐÚNG quyền đang gác
    // route này, không lẫn quyền của route khác lỡ khai ở cấp controller.
    const raw = this.reflector.getAllAndOverride<string | string[]>(REQUIRE_PERM, [ctx.getHandler(), ctx.getClass()]);
    const perms = (raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    if (!perms.length) return false; // @ScopedBy mà thiếu @RequirePerm đi kèm là cấu hình sai — fail-closed, không đoán


    // Tới đây meta CHẮC CHẮN không phải opt-out hợp lệ. Ép kiểu vì nhánh
    // `'none' in meta && meta.none === true` ở trên không thu hẹp union được
    // cho TS (metadata viết tay `{none:false}` vẫn rơi xuống đây — CÓ CHỦ Ý,
    // xem D-7); `param`/`field` khi đó là undefined và chốt chặn D-1 ngay bên
    // dưới bắt được, fail-closed.
    const target = meta as ScopedByEntity;
    const value = req.params?.[target.param];
    // ⚠⚠ FAIL-CLOSED, đừng gỡ (D-1 của review CUỐI nhánh feat/perm-scope).
    // Nếu `meta.param` không trỏ vào tham số route nào có thật (gõ nhầm
    // hoa/thường, hoặc một PR sau đổi `:cusId` -> `:code` mà quên decorator),
    // `value` là `undefined` — và Prisma XOÁ HẲN key `undefined` khỏi `where`
    // (dự án KHÔNG bật preview flag `strictUndefinedChecks`), nó KHÔNG dịch
    // thành "cột IS NULL". SQL sinh ra mất luôn vế định danh:
    //   { code: 'THẬT' }    -> WHERE (code = $1 AND (saler = $2 OR ...)) LIMIT 1
    //   { code: undefined } -> WHERE (saler = $1 OR ...)                 LIMIT 1
    // ⇒ câu hỏi thoái hoá thành "người gọi có sở hữu BẤT KỲ khách nào không",
    // thường là CÓ ⇒ guard trả true và handler chạy với nguyên chuỗi từ URL:
    // lỗ scope mở toang mà tsc xanh, lưới kiểm kê xanh, không log một dòng.
    // Ném ĐÚNG NotFoundException cũ (không phải 400/500): route cấu hình sai
    // phải trông y hệt mọi 404 khác, nếu không chính nó thành kênh rò rỉ mới.
    // Khoá lại ở test/iam/scope-guard.spec.ts (nhóm ca D-1).
    // (Đặt TRƯỚC buildDocScope: cấu hình sai là tính chất của ROUTE, không
    // phụ thuộc giá trị `cusId` nào, nên chặn sớm KHÔNG mở ra kênh thời gian
    // phân biệt bản ghi — chỉ tránh một truy vấn vô ích.)
    if (typeof value !== 'string' || value === '') throw new NotFoundException('Không tìm thấy');

    // ⚠⚠ GIAO của phạm vi MỌI mã quyền, KHÔNG phải "phạm vi của mã hẹp nhất".
    //
    // Bản cũ xếp hạng các mã bằng `rong()` rồi chỉ dùng phạm vi của mã thắng.
    // Sai, vì SCOPE_RANK KHÔNG phải quan hệ BAO HÀM (D-5 review cuối nhánh
    // feat/perm-scope). Nó chỉ đúng trên chuỗi own<team<dept<dept_tree<all, và
    // gãy ít nhất hai chỗ:
    //  (1) `warehouse`(5) xếp TRÊN `dept_tree`(4), nhưng với `Customer` nó là
    //      DENY (`buildDocScope` trả `{id:-1}` vì Customer không có cột kho)
    //      ⇒ hạng CAO hơn mà tập lại RỖNG ⇒ chọn dept_tree cho qua đúng thứ
    //      đáng chặn;
    //  (2) (lịch sử) `own` ⊄ `team`: trước D5 Task 1 (25/09/2026) `own` khớp cả
    //      `salerOther` còn `team` thì không — hai tập CẮT nhau. Nay `team` theo
    //      prod `tbs_team_salers` và khớp cả `salerOther` ⇒ `team` ⊇ `own` với
    //      user ĐANG hoạt động; user đã nghỉ ⇒ `team` DENY còn `own` giữ nguyên
    //      (không kiểm isActive) — tức vẫn KHÔNG phải thứ tự bao hàm cho mọi
    //      người, và (1) vẫn đúng. Lý do dùng GIAO bên dưới không đổi.
    //
    // Giao thì không cần bất kỳ thứ tự nào: giao của nhiều tập LUÔN ⊆ từng tập,
    // nên kết quả không bao giờ rộng hơn mã yếu nhất — đúng ý @ScopedBy (thu
    // hẹp thêm SAU PermGuard, không bao giờ nới ra).
    //
    // ⚠ Sửa được TẠI ĐÂY, không cần đụng `buildDocScope`: ghi chú cũ hoãn việc
    // này vì tưởng phải sửa hàm đó ở 5 module. Không — chỉ cần GỌI nó một lần
    // cho mỗi mã rồi AND kết quả lại. Blast radius = đúng file này.
    // Khoá bằng test/iam/scope-guard.spec.ts (khối "route nhiều quyền").
    const cfg = this.entityFor(target.entity);
    // Giá trị tham số route -> kiểu cột. Không ép được (vd `abc` cho cột id Int)
    // ⇒ ĐÚNG 404 cũ: một chuỗi không thể là khoá của bản ghi nào nên chặn sớm
    // không lộ gì về sự tồn tại; còn để lọt xuống Prisma thì nó NÉM lỗi kiểu
    // (500) — tức một kênh phân biệt với 404.
    const key = cfg.parse(value);
    if (key === null) throw new NotFoundException('Không tìm thấy');
    // `docFields` chỉ truyền khi entity CÓ khai — gọi 2 tham số cho customer
    // giữ nguyên hành vi cũ (mặc định của buildDocScope trùng khớp Customer).
    const scopeWheres = await Promise.all(
      perms.map(async (p) => {
        if (cfg.allOnly) return (await this.permSvc.scopeOf(p, uid)) === 'all' ? {} : { id: -1 };
        return cfg.docFields ? this.scope.buildDocScope(p, uid, cfg.docFields) : this.scope.buildDocScope(p, uid);
      }),
    );
    const hit = await cfg.delegate.findFirst({
      where: { AND: [{ [target.field]: key }, ...scopeWheres] },
      select: { id: true },
    });
    if (!hit) throw new NotFoundException('Không tìm thấy');
    return true;
  }

  /**
   * Bảng tra `entity` -> delegate Prisma.
   *
   * ⚠ Trước đây `ScopedByEntity.entity` chỉ là TRANG TRÍ: guard hard-code
   * `this.prisma.customer`, nên chỉ mỗi union TypeScript (`entity: 'customer'`)
   * ngăn route phi-customer đầu tiên lặng lẽ truy vấn nhầm bảng khách hàng —
   * và union thì biến mất lúc chạy. Một `@ScopedBy({entity:'order' as any})`
   * sẽ soi `Customer` rồi trả 404/200 theo dữ liệu của BẢNG KHÁC.
   *
   * Nay `entity` thật sự điều khiển hành vi, và entity lạ **fail-closed** chứ
   * không rơi về mặc định: mặc định im lặng đúng là cách lỗi trên đã sống sót.
   * Thêm entity mới = thêm một dòng ở đây, một hành động thấy được.
   */
  private entityFor(entity: ScopedByEntity['entity']): EntityCfg {
    const bang: Record<string, EntityCfg> = {
      customer: { delegate: this.prisma.customer, parse: (v) => v },
      // 09a Task 2 — phiếu thanh toán NCC (`tbl_payment`): chủ sở hữu là `saler`,
      // KHÔNG có cột người phụ trách phụ (salerOther) và không có cột kho ⇒ khai
      // rõ, nếu không buildDocScope dựng vế OR trỏ vào cột không tồn tại (500).
      supplierPayment: {
        delegate: this.prisma.supplierPayment,
        parse: parseIntId,
        docFields: { saler: 'saler', salerOther: null },
      },
      // 09b Task 3 — ví quỹ công ty (`tbl_accounts`), khoá `code`. Không có chủ sở hữu: sổ quỹ là
      // dữ liệu toàn công ty (prod: 14 user `account.view`, không lọc theo người) ⇒ chỉ `all`.
      fundAccount: { delegate: this.prisma.fundAccount, parse: (v) => v, allOnly: true },
      // #09d L11 Task 3 — PO (`tbl_purchase_orders`), khoá `id`. Chủ sở hữu = `createdBy`, đúng luật
      // `PoService.listForUser` (phạm vi PO của #06 — D5 chưa chốt). Phạm vi lạ ⇒ DENY trong
      // buildDocScope; `warehouse` ⇒ DENY vì PO không có cột kho. KHÔNG có salerOther.
      purchaseOrder: {
        delegate: this.prisma.purchaseOrder,
        parse: parseIntId,
        docFields: { saler: 'createdBy', salerOther: null },
      },
    };
    const cfg = Object.prototype.hasOwnProperty.call(bang, entity) ? bang[entity] : undefined;
    if (!cfg || !cfg.delegate) throw new NotFoundException('Không tìm thấy');
    return cfg;
  }
}
