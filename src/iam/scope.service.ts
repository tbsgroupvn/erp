import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermService } from './perm.service';
import { OrgService } from './org.service';
import { TeamScopeService } from './team-scope.service';
import { chuanTen, likeLiteral, tenHopLe } from './scope-names';

const DENY = { id: -1 } as const;

/** Khoá nối chứng từ → khách cho H3: `Customer.code` (chuỗi, mặc định) hoặc `Customer.id` (số). */
export type ViaCustomerKey = 'code' | 'id';

/** Mô tả cột chủ-sở-hữu của chứng từ cho `buildDocScope` — xem docblock của hàm đó. */
export type DocScopeFields = {
  saler?: string;
  salerOther?: string | null;
  warehouse?: string | null;
  viaCustomer?: string | null;
  viaCustomerKey?: ViaCustomerKey;
  unassigned?: boolean;
};

@Injectable()
export class ScopeService {
  private team: TeamScopeService;

  // `team` tuỳ chọn để các spec dựng tay `new ScopeService(prisma, perm, org)` (12 file) vẫn chạy
  // ĐÚNG luật team mới — thiếu thì tự dựng bản thật, KHÔNG rơi về luật cũ hay một bản giả.
  constructor(
    private prisma: PrismaService,
    private perm: PermService,
    private org: OrgService,
    @Optional() team?: TeamScopeService,
  ) {
    this.team = team ?? new TeamScopeService(prisma);
  }

  private async phongGoc(uid: number): Promise<number[]> {
    const scopes = await this.prisma.userScope.findMany({ where: { userId: uid, loai: 'dept' } });
    const fromScope = scopes.map((s) => parseInt(s.giaTri, 10)).filter((n) => n > 0);
    if (fromScope.length) return fromScope;
    const u = await this.prisma.user.findUnique({ where: { id: uid }, select: { phongbanId: true } });
    return u?.phongbanId ? [u.phongbanId] : [];
  }

  async buildStaffScope(perm: string, uid: number): Promise<Prisma.UserWhereInput> {
    const sc = await this.perm.scopeOf(perm, uid);
    if (sc === '') return { ...DENY };
    if (sc === 'all') return {};
    if (!uid || uid <= 0) return { ...DENY };
    if (sc === 'own') return { id: uid };
    if (sc === 'team') return { OR: [{ id: uid }, { leaderId: uid }] };
    if (sc === 'dept') {
      const u = await this.prisma.user.findUnique({ where: { id: uid }, select: { phongbanId: true } });
      return u?.phongbanId ? { phongbanId: u.phongbanId } : { id: uid };
    }
    if (sc === 'dept_tree') {
      const ids = await this.org.branchIds(await this.phongGoc(uid));
      return ids.length ? { phongbanId: { in: ids } } : { id: uid };
    }
    return { ...DENY };
  }

  /**
   * Dựng `where` lọc chứng từ theo phạm vi của user.
   *
   * ⚠ `fields` mô tả chứng từ ĐANG lọc có những cột chủ-sở-hữu nào:
   *  - `saler`      : cột người phụ trách chính. Mặc định `'saler'`.
   *  - `salerOther` : cột người phụ trách PHỤ (chuỗi JSON `["a","b"]`). Mặc định
   *                   `'salerOther'`. Truyền **`null`** nếu chứng từ KHÔNG có khái
   *                   niệm người phụ trách phụ — khi đó nhánh `own` chỉ lọc theo
   *                   `saler`, không dựng thêm vế OR trỏ vào cột không tồn tại.
   *  - `warehouse`  : cột kho. **Mặc định `null` = chứng từ KHÔNG có cột kho.**
   *
   * ⚠⚠ `warehouse` là OPT-IN có chủ ý (sửa 23/09/2026). Trước đây nó mặc định
   * `'storeId'` — nhưng **KHÔNG model nào trong schema có cột `storeId`**, nên
   * mọi user có quyền ở phạm vi `warehouse` đều làm Prisma NÉM
   * `PrismaClientValidationError` (lỗi 500) thay vì trả rỗng. Đã cắn thật ở cả
   * `CustomerService.listForUser` (#02) lẫn `QuoteService.listForUser` (#05).
   * Nay: không khai báo cột kho ⇒ **DENY** (fail-closed, đúng luật nền #4 của dự
   * án) thay vì dựng truy vấn hỏng. Chứng từ có cột kho thật thì truyền tên cột.
   *
   *  - `viaCustomer`: (D5 H3) cột MÃ KHÁCH trên chứng từ (vd `cusId`, `buyerCode`). Có khai ⇒ sở
   *                   hữu tính GIÁN TIẾP qua khách: lấy `Customer.code` trong phạm vi khách của user
   *                   (cùng mã quyền, cùng luật own/team/dept…) rồi trả `{[cột]: {in: codes}}`; khi
   *                   đó `saler`/`salerOther`/`warehouse` của chứng từ bị BỎ QUA. `codes=[]` ⇒ DENY.
   *                   ⚠ KHÔNG lọc `Customer.isactive` — QUYẾT ĐỊNH Q-D5-9 (25/09/2026): khách ngừng
   *                   hoạt động vẫn thấy (KHÁC prod `index.php:540` và khác §3 H3 của tài liệu D5).
   *  - `viaCustomerKey`: (D5 Task 2) `'code'` (mặc định, `Customer.code`) hoặc `'id'` (`Customer.id` —
   *                   PO `buyerId`, xem `PO_OWNER_FIELDS`). Khoá lạ ⇒ DENY.
   *  - `unassigned` : (D5 Task 2, Q-D5-7) cộng các dòng CHƯA gán khách (`col` NULL / ''). Chỉ đi cùng
   *                   `viaCustomer` + khoá `code`; khai lẻ ⇒ DENY. Xem `src/bank/bank-scope.ts`.
   *
   * Nhánh `team` (D5 H2, 25/09/2026): tên = `TeamScopeService.teamSalers(uid)` (chép prod
   * `tbs_team_salers`), khớp CẢ `saler` lẫn `salerOther` như `own` ⇒ `team` ⊇ `own` (với user đang
   * hoạt động), và người không làm leader/phó thì `team` ≡ `own`. Tên rỗng ⇒ DENY. Trước đó `team` =
   * mình + `User.leaderId=uid`, chỉ so `saler` (nguồn ghi chú D-5 "`own` ⊄ `team`" ở scope.guard.ts).
   */
  async buildDocScope(
    perm: string,
    uid: number,
    fields?: DocScopeFields,
  ): Promise<any> {
    if (fields?.viaCustomer !== undefined && fields.viaCustomer !== null) {
      return this.viaCustomerScope(perm, uid, fields.viaCustomer, fields.viaCustomerKey ?? 'code', fields.unassigned === true);
    }
    // `unassigned`/`viaCustomerKey` chỉ có nghĩa cùng `viaCustomer` — khai lẻ là cấu hình sai ⇒ DENY,
    // không lặng lẽ bỏ qua (người khai tưởng đã có vế "chưa gán" mà thực ra không).
    if (fields?.unassigned === true || fields?.viaCustomerKey !== undefined) return { ...DENY };
    const F = {
      saler: fields?.saler ?? 'saler',
      salerOther: fields?.salerOther === undefined ? 'salerOther' : fields.salerOther,
      warehouse: fields?.warehouse ?? null,
    };
    const sc = await this.perm.scopeOf(perm, uid);
    if (sc === '') return { ...DENY };
    if (sc === 'all') return {};
    const me = await this.prisma.user.findUnique({ where: { id: uid }, select: { username: true, phongbanId: true } });
    if (!me?.username) return { ...DENY };

    if (sc === 'own') {
      // Chứng từ không có cột người phụ trách PHỤ (salerOther === null) thì chỉ
      // lọc theo saler — KHÔNG dựng vế OR trỏ vào cột không tồn tại.
      // Fix round 1: tên chuẩn hoá (trimEnd) + thoát LIKE — cùng luật với nhánh team ⇒ team ≡ own.
      const ten = chuanTen(me.username);
      if (ten === null) return { ...DENY };
      if (F.salerOther === null) return { [F.saler]: ten };
      return { OR: [{ [F.saler]: ten }, { [F.salerOther]: { contains: `"${likeLiteral(ten)}"` } }] };
    }
    if (sc === 'team') {
      // ⚠ Lọc LẠI ở đây dù TeamScopeService đã lọc: `undefined` bị Prisma xoá khỏi where (vế biến
      // mất), `''` làm `contains '""'` khớp bừa. Rỗng ⇒ DENY — không bao giờ `{}` / `OR: []`.
      const raw: unknown[] = await this.team.teamSalers(uid);
      const names = [...new Set(raw.map(chuanTen).filter((n): n is string => n !== null))];
      if (!names.length) return { ...DENY };
      if (F.salerOther === null) return { [F.saler]: { in: names } };
      const col = F.salerOther;
      // ⚠ likeLiteral: Prisma KHÔNG thoát `%`/`_`/`\` trong `contains` (xem scope-names.ts).
      return { OR: names.flatMap((n) => [{ [F.saler]: n }, { [col]: { contains: `"${likeLiteral(n)}"` } }]) };
    }
    if (sc === 'dept' || sc === 'dept_tree') {
      let deptIds: number[] = me.phongbanId ? [me.phongbanId] : [];
      if (sc === 'dept_tree') deptIds = await this.org.branchIds(await this.phongGoc(uid));
      if (!deptIds.length) return { [F.saler]: me.username };
      const users = await this.prisma.user.findMany({ where: { phongbanId: { in: deptIds }, isActive: true }, select: { username: true } });
      const names = users.map((u) => u.username);
      return names.length ? { [F.saler]: { in: names } } : { ...DENY };
    }
    if (sc === 'warehouse') {
      // Chứng từ không khai báo cột kho ⇒ DENY. KHÔNG dựng filter lên một cột
      // không tồn tại (trước đây mặc định 'storeId' → Prisma ném lỗi 500).
      if (F.warehouse === null) return { ...DENY };
      const khos = await this.prisma.userScope.findMany({ where: { userId: uid, loai: 'warehouse' }, select: { giaTri: true } });
      const vals = khos.map((k) => k.giaTri);
      return vals.length ? { [F.warehouse]: { in: vals } } : { ...DENY };
    }
    return { ...DENY };
  }

  /**
   * D5 H3 — xem docblock `buildDocScope` (`fields.viaCustomer`).
   *
   * Task 2 mở rộng (25/09/2026):
   *  - `key='id'`: chứng từ nối khách bằng `Customer.id` (PO `buyerId`) thay vì `Customer.code`.
   *  - `unassigned=true` (Q-D5-7, `bank.view` kind `via_customer_or_unassigned`): CỘNG các dòng chưa
   *    gán khách (`col IS NULL` hoặc `col = ''`). Chỉ áp khi danh tính + phạm vi khách HỢP LỆ; phạm
   *    vi khách DENY (không quyền, username rỗng, `warehouse`…) ⇒ DENY toàn bộ, KHÔNG rơi về "chỉ
   *    chưa gán". Không có khách nào ⇒ CHỈ dòng chưa gán (không `in: []`).
   *    Chỉ hợp lệ với `key='code'` (cột chuỗi); `key='id'` + `unassigned` ⇒ DENY (cấu hình sai).
   */
  private async viaCustomerScope(
    perm: string, uid: number, col: unknown, key: unknown = 'code', unassigned = false,
  ): Promise<any> {
    if (!tenHopLe(col)) return { ...DENY }; // cấu hình sai — không dựng where lên cột rỗng
    if (key !== 'code' && key !== 'id') return { ...DENY }; // khoá lạ — không đoán
    if (unassigned && key !== 'code') return { ...DENY };
    const sc = await this.perm.scopeOf(perm, uid);
    if (sc === '') return { ...DENY };
    if (sc === 'all') return {};
    // Phạm vi khách theo ĐÚNG mã quyền này, cột mặc định của Customer (saler/salerOther, không kho
    // ⇒ `warehouse` tự DENY). Chốt thêm: where khách rỗng/DENY thì dừng, KHÔNG truy vấn cả bảng.
    const cusWhere = await this.buildDocScope(perm, uid);
    if (!cusWhere || typeof cusWhere !== 'object' || Object.keys(cusWhere).length === 0) return { ...DENY };
    if ((cusWhere as { id?: unknown }).id === DENY.id) return { ...DENY };
    let vals: (string | number)[];
    if (key === 'id') {
      const rows = await this.prisma.customer.findMany({ where: cusWhere, select: { id: true } });
      vals = [...new Set(rows.map((r) => r.id).filter((n) => Number.isInteger(n) && n > 0))];
    } else {
      const rows = await this.prisma.customer.findMany({ where: cusWhere, select: { code: true } });
      vals = [...new Set(rows.map((r) => r.code).filter(tenHopLe))];
    }
    if (!unassigned) return vals.length ? { [col]: { in: vals } } : { ...DENY };
    const chuaGan = [{ [col]: null }, { [col]: '' }];
    return { OR: vals.length ? [{ [col]: { in: vals } }, ...chuaGan] : chuaGan };
  }
}
