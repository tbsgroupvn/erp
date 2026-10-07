import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { ScopeGuard } from '../../src/iam/scope.guard';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';

// Task 1 của kế hoạch "@RequirePerm nhận biết PHẠM VI"
// (.superpowers/sdd/2026-09-24-perm-scope-plan/task-1-brief.md).
//
// LỖ ĐANG ĐÓNG: PermGuard (Task 5 PART A trước đó) chỉ xác nhận "có quyền GỌI
// route ví" — không xác nhận "khách ứng với :cusId có nằm trong phạm vi của
// người gọi". Sale phạm vi 'own' giữ token hợp lệ + wallet.view vẫn dò được
// TBS0001..TBS9999 và đọc số dư của MỌI khách. @ScopedBy + ScopeGuard nối
// phần PermGuard bỏ trống: MỘT truy vấn `findFirst` gộp cả điều kiện tồn tại
// lẫn điều kiện phạm vi, khách NGOÀI phạm vi nhận đúng 404 như khách KHÔNG
// TỒN TẠI — không đổi thứ rò rỉ từ "số dư" sang "sự tồn tại".
//
// Dựng app qua createApp() (KHÔNG tự lắp lại Test.createTestingModule) —
// cùng lý do đã ghi ở test/auth/wallet-endpoints.spec.ts: hardening
// (helmet/ValidationPipe/3 guard toàn cục) chỉ chắc chắn có mặt nếu đi qua
// ĐÚNG entrypoint production dùng.
let app: INestApplication;
let jwtSvc: JwtService;

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
});
beforeEach(async () => {
  await resetIam();
  app.get(PermService).clearCache();
  await resetMasterdata();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return jwtSvc.signAsync({ sub: user.id, username: user.username });
}

async function seedGranted(username: string, grants: { code: string; scope: Scope }[]) {
  const u = await seedUser({ username });
  const r = await seedRole('zzscope-' + username + '-' + grants.map((g) => g.code + g.scope).join('-'), grants);
  await assignRole(u.id, r.id);
  app.get(PermService).clearCache();
  return u;
}

describe('ScopeGuard — GET /wallets/:cusId/available', () => {
  it('CA CỐT LÕI: sale phạm vi own KHÔNG đọc được ví của khách người khác (404, không phải 200)', async () => {
    const sale = await seedGranted('ZZSCOPE_sale', [{ code: 'wallet.view', scope: Scope.own }]);
    await seedCustomer('ZZSCOPE_C1', 'ZZSCOPE_sale');
    await seedCustomer('ZZSCOPE_C2', 'ZZSCOPE_khac');
    const t = await tokenFor(sale);
    await request(app.getHttpServer())
      .get('/wallets/ZZSCOPE_C2/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(404);
  });

  it('CA ĐỐI CHỨNG: sale phạm vi own VẪN đọc được ví khách của chính mình (200) — '
    + 'không có ca này thì một guard chặn-sạch-mọi-thứ cũng làm ca cốt lõi xanh', async () => {
    const sale = await seedGranted('ZZSCOPE_sale', [{ code: 'wallet.view', scope: Scope.own }]);
    await seedCustomer('ZZSCOPE_C1', 'ZZSCOPE_sale');
    const t = await tokenFor(sale);
    await request(app.getHttpServer())
      .get('/wallets/ZZSCOPE_C1/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
  });

  it('khách NGOÀI phạm vi và khách KHÔNG TỒN TẠI trả về GIỐNG HỆT nhau (status + body) — '
    + 'không đổi thứ rò rỉ từ số dư sang sự tồn tại', async () => {
    const sale = await seedGranted('ZZSCOPE_sale', [{ code: 'wallet.view', scope: Scope.own }]);
    await seedCustomer('ZZSCOPE_C1', 'ZZSCOPE_sale');
    await seedCustomer('ZZSCOPE_C2', 'ZZSCOPE_khac');
    const t = `Bearer ${await tokenFor(sale)}`;
    const ngoaiPhamVi = await request(app.getHttpServer()).get('/wallets/ZZSCOPE_C2/available').set('Authorization', t);
    const khongTonTai = await request(app.getHttpServer()).get('/wallets/ZZSCOPE_KHONGCO/available').set('Authorization', t);
    expect(ngoaiPhamVi.status).toBe(404);
    expect(ngoaiPhamVi.status).toBe(khongTonTai.status);
    expect(ngoaiPhamVi.body).toEqual(khongTonTai.body);
  });

  it('phạm vi all vẫn đọc được ví của bất kỳ khách nào (đối chứng: guard không siết quá tay khi scope=all)', async () => {
    const admin = await seedGranted('ZZSCOPE_admin', [{ code: 'wallet.view', scope: Scope.all }]);
    await seedCustomer('ZZSCOPE_C9', 'ZZSCOPE_ai_do_khac');
    const t = await tokenFor(admin);
    await request(app.getHttpServer())
      .get('/wallets/ZZSCOPE_C9/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
  });
});

describe('ScopeGuard — POST /wallets/:cusId/repair-cache (route NHIỀU mã @RequirePerm)', () => {
  // Quyết định thiết kế: buildDocScope chỉ nhận MỘT mã quyền, nhưng route này
  // khai HAI (wallet.repair + wallet.view). Chọn mã có PHẠM VI HẸP NHẤT —
  // lấy mã rộng nhất tương đương nới cổng bằng đúng mã yếu nhất trong nhóm.
  it('wallet.repair=own hẹp hơn wallet.view=all -> DÙNG own -> khách NGOÀI phạm vi own bị 404', async () => {
    const u = await seedGranted('ZZSCOPE_repairer', [
      { code: 'wallet.repair', scope: Scope.own },
      { code: 'wallet.view', scope: Scope.all },
    ]);
    await seedCustomer('ZZSCOPE_C7', 'ZZSCOPE_nguoi_khac');
    const t = await tokenFor(u);
    await request(app.getHttpServer())
      .post('/wallets/ZZSCOPE_C7/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(404);
  });

  it('CA ĐỐI CHỨNG: cùng user, khách NẰM TRONG phạm vi own của wallet.repair thì qua được (201)', async () => {
    const u = await seedGranted('ZZSCOPE_repairer', [
      { code: 'wallet.repair', scope: Scope.own },
      { code: 'wallet.view', scope: Scope.all },
    ]);
    await seedCustomer('ZZSCOPE_C8', 'ZZSCOPE_repairer');
    const t = await tokenFor(u);
    const res = await request(app.getHttpServer())
      .post('/wallets/ZZSCOPE_C8/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);
    expect(res.body).toEqual({ balance: '0' });
  });

  // ⚠ D-6 của review CUỐI nhánh: hai ca trên KHÔNG chạm vòng lặp chọn phạm vi.
  // Decorator khai `@RequirePerm('wallet.repair','wallet.view')` nên perms[0] =
  // wallet.repair; hai ca trên cấp repair=own + view=all, tức mã HẸP NHẤT đã
  // nằm sẵn ở perms[0] và `narrowest` ĐÚNG TRƯỚC KHI vòng `for` chạy lần nào.
  // Mutant "xoá hẳn vòng lặp, luôn dùng perms[0]" SỐNG SÓT qua cả hai. Ca dưới
  // đảo phạm vi (repair=all khai TRƯỚC, view=own khai SAU) nên đáp án đúng chỉ
  // có thể đến TỪ vòng lặp — xoá vòng lặp là ca này đỏ.
  it('vòng chọn HẸP NHẤT: mã khai TRƯỚC rộng (wallet.repair=all), mã khai SAU hẹp '
    + '(wallet.view=own) -> phải chọn own -> khách người khác bị 404', async () => {
    const u = await seedGranted('ZZSCOPE_repairer2', [
      { code: 'wallet.repair', scope: Scope.all },
      { code: 'wallet.view', scope: Scope.own },
    ]);
    await seedCustomer('ZZSCOPE_C6', 'ZZSCOPE_nguoi_khac');
    const t = await tokenFor(u);
    await request(app.getHttpServer())
      .post('/wallets/ZZSCOPE_C6/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(404);
  });

  it('CA ĐỐI CHỨNG cho vòng chọn hẹp nhất: cùng cấu hình quyền, khách CỦA CHÍNH '
    + 'mình vẫn qua được (201) — guard không chặn sạch mọi thứ', async () => {
    const u = await seedGranted('ZZSCOPE_repairer2', [
      { code: 'wallet.repair', scope: Scope.all },
      { code: 'wallet.view', scope: Scope.own },
    ]);
    await seedCustomer('ZZSCOPE_C6', 'ZZSCOPE_repairer2');
    const t = await tokenFor(u);
    await request(app.getHttpServer())
      .post('/wallets/ZZSCOPE_C6/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUYẾT ĐỊNH ĐÃ HOÃN, NAY KHOÁ LẠI BẰNG TEST (review CUỐI nhánh, mục (b)).
//
// `PermGuard` có ngoại lệ super admin (perm.guard.ts:42 — `isSuperAdmin` ->
// return true, KHÔNG gọi perm.can). `ScopeGuard` CỐ Ý KHÔNG có ngoại lệ đó:
// nó đi qua buildDocScope y như 4 nơi gọi còn lại (customer/po/quote/
// khotq-receipt), nơi super admin cũng KHÔNG được ưu tiên. Thêm một `if
// (isSuperAdmin)` vào riêng ScopeGuard là chữa một bất đối xứng bằng cách đẻ
// ra cái thứ hai, lệch với 4 nơi kia. Chỗ đúng để quyết là bên trong
// buildDocScope (hoặc một effectiveScope() dùng chung) — chạm PO, báo giá,
// kho, khách hàng cùng lúc, KHÔNG làm ké trong một nhánh bảo mật 2 commit.
// Kế hoạch: F:/01_TBS_GROUP/docs/rewrite-spec/plans/2026-09-24-perm-scope-plan.md
//
// ⚠ TRIỆU CHỨNG VẬN HÀNH của quyết định này (biết trước, chấp nhận trước):
// super admin KHÔNG có grant `wallet.view` được PermGuard CHO QUA rồi bị
// ScopeGuard 404 — và cái 404 đó CỐ Ý không mang thông tin gì ("Không tìm
// thấy"), vì toàn nhánh này dựng quanh việc 404 không được phân biệt
// "ngoài phạm vi" với "không tồn tại". Tức đây là triệu chứng KHÓ CHẨN ĐOÁN
// NHẤT có thể có, do chính thiết kế sinh ra. Ai đọc tới đây mà định "sửa"
// bằng một if trong ScopeGuard: đọc lại đoạn trên trước.
// Cách xử lý đúng khi gặp ngoài đời: cấp cho tài khoản đó một vai có
// `wallet.*` scope='all' — KHÔNG nới scope='all' trên một vai DÙNG CHUNG.
// ═══════════════════════════════════════════════════════════════════════════
describe('ScopeGuard — super admin (hành vi HOÃN SỬA, khoá lại có chủ ý)', () => {
  it('super admin KHÔNG có grant wallet.view nhận 404 ở route @ScopedBy (PermGuard cho qua, '
    + 'ScopeGuard chặn) — CỐ Ý, xem khối chú thích ngay trên', async () => {
    const su = await seedUser({ username: 'ZZSCOPE_superadmin', isSuperAdmin: true });
    app.get(PermService).clearCache();
    await seedCustomer('ZZSCOPE_C5', 'ZZSCOPE_ai_do_khac');
    const t = await tokenFor(su);
    await request(app.getHttpServer())
      .get('/wallets/ZZSCOPE_C5/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(404);
  });
});

describe('ScopeGuard — fail-closed đơn vị (không qua HTTP, canh đúng nhánh guard)', () => {
  function ctxWithMeta(meta: unknown, reqOverrides: Record<string, unknown> = {}) {
    const req = { params: { cusId: 'X' }, user: undefined, ...reqOverrides };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
  }

  it('không có @ScopedBy -> bỏ qua (true), KHÔNG đụng DB (PermGuard vẫn gác riêng)', async () => {
    const reflector = { getAllAndOverride: () => undefined } as any;
    const scopeSvc = { buildDocScope: jest.fn() } as any;
    const permSvc = { scopeOf: jest.fn() } as any;
    const prismaStub = { customer: { findFirst: jest.fn() } } as any;
    const guard = new ScopeGuard(reflector, scopeSvc, permSvc, prismaStub);
    await expect(guard.canActivate(ctxWithMeta(undefined))).resolves.toBe(true);
    expect(prismaStub.customer.findFirst).not.toHaveBeenCalled();
  });

  it('có @ScopedBy nhưng KHÔNG có req.user.sub -> từ chối (fail-closed), KHÔNG đụng DB', async () => {
    const meta = { entity: 'customer', param: 'cusId', field: 'code' };
    const reflector = { getAllAndOverride: (key: string) => (key === require('../../src/iam/scoped-by.decorator').SCOPED_BY ? meta : ['wallet.view']) } as any;
    const scopeSvc = { buildDocScope: jest.fn() } as any;
    const permSvc = { scopeOf: jest.fn() } as any;
    const prismaStub = { customer: { findFirst: jest.fn() } } as any;
    const guard = new ScopeGuard(reflector, scopeSvc, permSvc, prismaStub);
    await expect(guard.canActivate(ctxWithMeta(meta, { user: undefined }))).resolves.toBe(false);
    expect(prismaStub.customer.findFirst).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // D-1 của review CUỐI nhánh — guard từng FAIL-OPEN ở đúng lỗi cấu hình dễ
  // xảy ra nhất: `@ScopedBy({ param })` KHÔNG trỏ vào tham số route nào có
  // thật (gõ nhầm hoa/thường, hoặc một PR sau đổi `:cusId` thành `:code` mà
  // quên decorator). Khi đó `req.params[param]` là `undefined`, và Prisma
  // XOÁ HẲN key `undefined` khỏi `where` (dự án KHÔNG bật preview flag
  // `strictUndefinedChecks`) — SQL sinh ra mất luôn vế `code = $1`:
  //     where { code: 'THẬT' }     -> SELECT id FROM tbl_customer WHERE (code = $1 AND (saler = $2 OR ...)) LIMIT 1
  //     where { code: undefined }  -> SELECT id FROM tbl_customer WHERE (saler = $1 OR ...) LIMIT 1
  // Câu hỏi thoái hoá thành "người gọi có SỞ HỮU BẤT KỲ khách nào không?" —
  // với một sale bất kỳ thì gần như luôn ĐÚNG ⇒ guard trả true, handler chạy
  // với nguyên chuỗi lấy từ URL. Không có gì đỏ: tsc xanh, lưới kiểm kê xanh,
  // không log gì. Vì vậy stub dưới đây trả về MỘT bản ghi (mô phỏng "người
  // gọi có sở hữu khách nào đó") — đó mới là điều kiện làm lỗ này lộ ra; stub
  // trả null sẽ ném 404 vì lý do KHÁC và ca test xanh một cách vô nghĩa.
  // Từ chối bằng ĐÚNG NotFoundException cũ để giữ tính không-phân-biệt: route
  // cấu hình sai trông y hệt mọi 404 khác, không thành một kênh rò rỉ mới.
  // ═════════════════════════════════════════════════════════════════════════
  function guardWithHit(meta: unknown, hit: unknown) {
    const { SCOPED_BY } = require('../../src/iam/scoped-by.decorator');
    const reflector = { getAllAndOverride: (key: string) => (key === SCOPED_BY ? meta : ['wallet.view']) } as any;
    const scopeSvc = { buildDocScope: jest.fn().mockResolvedValue({}) } as any;
    const permSvc = { scopeOf: jest.fn().mockResolvedValue('own') } as any;
    const prismaStub = { customer: { findFirst: jest.fn().mockResolvedValue(hit) } } as any;
    return { guard: new ScopeGuard(reflector, scopeSvc, permSvc, prismaStub), prismaStub };
  }

  it('D-1: @ScopedBy.param KHÔNG khớp tham số route nào có thật -> ném 404 (fail-CLOSED), '
    + 'dù người gọi có sở hữu khách khác', async () => {
    const meta = { entity: 'customer', param: 'cusid', field: 'code' }; // gõ nhầm hoa/thường
    const { guard } = guardWithHit(meta, { id: 1 });
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).rejects.toThrow(NotFoundException);
  });

  it('D-1: param không khớp -> KHÔNG đụng DB (không để lọt truy vấn mất vế điều kiện)', async () => {
    const meta = { entity: 'customer', param: 'cusid', field: 'code' };
    const { guard, prismaStub } = guardWithHit(meta, { id: 1 });
    await guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } })).catch(() => undefined);
    expect(prismaStub.customer.findFirst).not.toHaveBeenCalled();
  });

  // Nhánh `!perms.length` (@ScopedBy mà QUÊN @RequirePerm đi kèm) -> return
  // false -> Nest dựng ForbiddenException 403. Fail-closed đúng, nhưng review
  // cuối nhánh chỉ ra nó CHƯA có test nào đi qua: một mutant đổi thành
  // `return true` sẽ sống, và khi đó route khai @ScopedBy mà thiếu quyền sẽ
  // chạy KHÔNG có cả hai lớp gác.
  it('@ScopedBy mà THIẾU @RequirePerm -> từ chối (false), KHÔNG đoán phạm vi', async () => {
    const { SCOPED_BY } = require('../../src/iam/scoped-by.decorator');
    const meta = { entity: 'customer', param: 'cusId', field: 'code' };
    const reflector = { getAllAndOverride: (key: string) => (key === SCOPED_BY ? meta : undefined) } as any;
    const guard = new ScopeGuard(reflector, { buildDocScope: jest.fn() } as any, { scopeOf: jest.fn() } as any, { customer: { findFirst: jest.fn() } } as any);
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).resolves.toBe(false);
  });

  // `ScopedByEntity.entity` TỪNG chỉ là trang trí: guard hard-code
  // `prisma.customer`, nên chỉ mỗi union TypeScript ngăn route phi-customer
  // truy vấn nhầm bảng khách hàng — mà union biến mất lúc chạy. Nay `entity`
  // thật sự chọn delegate, và entity lạ fail-CLOSED thay vì rơi về mặc định.
  it('entity KHÔNG có trong bảng tra -> 404 (fail-closed), KHÔNG lặng lẽ soi bảng customer', async () => {
    const meta = { entity: 'order', param: 'cusId', field: 'code' }; // entity chưa đăng ký
    const { guard } = guardWithHit(meta, { id: 1 });
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).rejects.toThrow(NotFoundException);
  });

  it('entity lạ -> KHÔNG đụng bảng customer', async () => {
    const meta = { entity: 'order', param: 'cusId', field: 'code' };
    const { guard, prismaStub } = guardWithHit(meta, { id: 1 });
    await guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } })).catch(() => undefined);
    expect(prismaStub.customer.findFirst).not.toHaveBeenCalled();
  });

  it('D-1 ĐỐI CHỨNG: param KHỚP thì vẫn đi qua truy vấn bình thường (true khi có bản ghi trong phạm vi)', async () => {
    const meta = { entity: 'customer', param: 'cusId', field: 'code' };
    const { guard } = guardWithHit(meta, { id: 1 });
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).resolves.toBe(true);
  });

  // D-7: guard nhận opt-out theo SỰ CÓ MẶT của key `none` (`'none' in meta`),
  // còn lưới route-inventory đọc `none === true`. Metadata viết tay
  // `{ none:false, entity, param, field }` vì thế BỎ QUA guard lúc chạy trong
  // khi lưới vẫn đọc nó như một scope thật và cho xanh — hai tầng đọc CÙNG
  // một field theo hai luật khác nhau là chỗ để lọt. Chỉ với tay tới được khi
  // đánh bại TS union (SetMetadata viết tay / `as any` / consumer JS), nhưng
  // giá đóng là một dấu `=== true`.
  it('D-7: metadata { none:false } KHÔNG phải opt-out — guard vẫn đối chiếu phạm vi và 404', async () => {
    const meta = { none: false, entity: 'customer', param: 'cusId', field: 'code' };
    const { guard } = guardWithHit(meta, null);
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).rejects.toThrow(NotFoundException);
  });

  it('D-7 ĐỐI CHỨNG: opt-out THẬT { none:true } vẫn được bỏ qua (true)', async () => {
    const meta = { none: true, reason: 'ca thử' };
    const { guard } = guardWithHit(meta, { id: 1 });
    await expect(guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }))).resolves.toBe(true);
  });

  it('D-7 ĐỐI CHỨNG: opt-out THẬT { none:true } KHÔNG đụng DB', async () => {
    const meta = { none: true, reason: 'ca thử' };
    const { guard, prismaStub } = guardWithHit(meta, { id: 1 });
    await guard.canActivate(ctxWithMeta(meta, { user: { sub: 7 } }));
    expect(prismaStub.customer.findFirst).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D-5 của review CUỐI nhánh feat/perm-scope: SCOPE_RANK KHÔNG phải quan hệ BAO HÀM.
//
// Route `repair-cache` mang HAI mã quyền (wallet.repair + wallet.view). Bản cũ
// chọn MỘT mã "hẹp nhất" theo rong(), rồi chỉ dùng phạm vi của mã đó. Nhưng
// rong() chỉ đúng trên chuỗi own<team<dept<dept_tree<all; `warehouse`(5) xếp
// TRÊN `dept_tree`(4) trong khi với Customer nó là DENY (không có cột kho)
// ⇒ chọn dept_tree là RỘNG HƠN giao thật (rỗng) ⇒ cho qua thứ đáng chặn.
//
// Lời giải đúng: AND phạm vi của TẤT CẢ các mã, không chọn một mã. Giao của
// nhiều tập LUÔN hẹp hơn hoặc bằng từng tập — không cần thứ tự bao hàm nào.
describe('phạm vi của route nhiều quyền = GIAO của mọi mã, không phải "mã hẹp nhất"', () => {
  it('một mã cho DENY thì cả route DENY, dù mã kia rộng rãi', async () => {
    const u = await seedUser({ username: 'ZZRANK_u' });
    // wallet.view: dept_tree — với Customer là lọc theo danh sách username.
    // wallet.repair: warehouse — với Customer là DENY (buildDocScope trả {id:-1}
    // vì Customer không có cột kho). Giao ⇒ RỖNG ⇒ phải 404.
    const r = await seedRole('zzrank-role', [
      { code: 'wallet.view', scope: 'dept_tree' as Scope },
      { code: 'wallet.repair', scope: 'warehouse' as Scope },
    ]);
    await assignRole(u.id, r.id);
    await seedCustomer('ZZRANK_C1', 'ZZRANK_u');

    await request(app.getHttpServer())
      .post('/wallets/ZZRANK_C1/repair-cache')
      .set('Authorization', `Bearer ${await tokenFor(u)}`)
      .expect(404);
  });

  it('ĐỐI CHỨNG: cùng cấu hình nhưng cả hai mã đều "all" thì vẫn qua', async () => {
    // Không có ca này thì một guard chặn-sạch-mọi-thứ cũng làm ca trên xanh.
    const u = await seedUser({ username: 'ZZRANK_v' });
    const r = await seedRole('zzrank-role2', [
      { code: 'wallet.view', scope: 'all' as Scope },
      { code: 'wallet.repair', scope: 'all' as Scope },
    ]);
    await assignRole(u.id, r.id);
    await seedCustomer('ZZRANK_C2', 'ZZRANK_khac');

    await request(app.getHttpServer())
      .post('/wallets/ZZRANK_C2/repair-cache')
      .set('Authorization', `Bearer ${await tokenFor(u)}`)
      .expect(201);
  });
});
