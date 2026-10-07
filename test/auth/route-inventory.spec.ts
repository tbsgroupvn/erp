import { Controller, Get, INestApplication, Param } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RequestMethod } from '@nestjs/common';
import { createApp } from '../../src/main';
import { IS_PUBLIC } from '../../src/auth/public.decorator';
import { REQUIRE_PERM } from '../../src/iam/require-perm.decorator';
import { SCOPED_BY, ScopedByEntity, ScopedByOptions } from '../../src/iam/scoped-by.decorator';

// ═══════════════════════════════════════════════════════════════════════════
// LƯỚI KIỂM KÊ ROUTE (F-3 của review CUỐI nhánh feat/api-dot1).
//
// Vấn đề nó đóng: `PermGuard` mở đầu bằng `if (!need) return true` — tức tầng
// XÁC THỰC đóng mặc định (@Public là lối mở duy nhất) nhưng tầng PHÂN QUYỀN
// lại MỞ mặc định, và "lối mở" của nó là sự IM LẶNG: quên gắn @RequirePerm
// không để lại dấu vết nào trong diff. Lật mặc định của guard (`return false`)
// sẽ làm mọi route không khai quyền thành 403 lúc CHẠY — phát hiện muộn, và
// vẫn cần một lối thoát (@NoPermRequired) tức lại là một sự im lặng khác.
//
// Cách đóng dứt điểm: kiểm kê TĨNH-nhưng-TỪ-APP-THẬT. Dựng đúng app mà
// production dựng (createApp -> AppModule), duyệt TOÀN BỘ controller đã đăng
// ký trong DI container, liệt kê MỌI method có metadata route của Nest, và
// đòi mỗi cái phải mang @Public() HOẶC @RequirePerm. Quên decorator ⇒ BUILD ĐỎ
// ngay tại commit đó, không phải một lỗ im lặng chờ ngày bị dò.
//
// ⚠ Vì sao duyệt DI container chứ không grep mã nguồn: grep chỉ thấy cái mình
// nghĩ ra mẫu cho (bài học lặp 2 lần ở nhánh này: `e.message` bỏ lọt
// `e?.message`; `new PrismaClient()` bỏ lọt phép nhân instance qua DI). Route
// "đã đăng ký thật" là câu hỏi RUNTIME — hỏi đúng cái đang chạy thì không có
// biến thể cú pháp nào lọt được.
// ═══════════════════════════════════════════════════════════════════════════

type HandlerInfo = {
  label: string;
  isPublic: boolean;
  perms: string[];
  /** Tên các tham số route (`:cusId` -> `'cusId'`), rút từ path THẬT của Nest — xem khối chú thích Task 2 bên dưới về vì sao MỌI tham số tính, không chỉ tên "trông giống" định danh. */
  params: string[];
  scopedBy: ScopedByOptions | undefined;
};

function methodName(m: number): string {
  return RequestMethod[m] ?? String(m);
}

/**
 * Mọi tên method của lớp, KỂ CẢ thừa kế từ lớp cha — sao đúng vòng duyệt của
 * `MetadataScanner#getAllMethodNames` trong Nest
 * (node_modules/@nestjs/core/metadata-scanner.js:60-78). Bản cũ dùng thẳng
 * `Object.getOwnPropertyNames(cls.prototype)`: MỘT tầng, trong khi Nest ĐĂNG KÝ
 * VÀ PHỤC VỤ cả handler khai ở lớp cha ⇒ một `class X extends BaseCrud {}` có
 * route sống mà lưới trả về RỖNG cho nó — cả lưới @RequirePerm lẫn lưới
 * @ScopedBy cùng xanh trên một route mở toang (D-3 của review cuối nhánh).
 *
 * ⚠ Phải đọc descriptor TRƯỚC khi chạm `prototype[name]`: với getter, chỉ việc
 * đọc đã là GỌI. Nest bỏ qua getter/setter, ta bỏ qua y hệt — lưới phải nhìn
 * đúng cái Nest nhìn, không hơn không kém.
 */
function allMethodNames(prototype: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let proto = prototype;
  do {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (seen.has(name)) continue; // override ở lớp con che lớp cha — tính MỘT lần
      seen.add(name);
      if (name === 'constructor') continue;
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      if (!desc || desc.get || desc.set) continue;
      if (typeof proto[name] !== 'function') continue;
      out.push(name);
    }
  } while ((proto = Reflect.getPrototypeOf(proto)) && proto !== Object.prototype);
  return out;
}

/** Liệt kê mọi handler route đã ĐĂNG KÝ trong app (đi qua DI container thật). */
function inventory(app: INestApplication): HandlerInfo[] {
  const reflector = app.get(Reflector);
  const modules = (app as any).container.getModules() as Map<string, any>;
  const out: HandlerInfo[] = [];
  for (const [, mod] of modules) {
    for (const [, wrapper] of mod.controllers as Map<any, any>) {
      const cls = wrapper.metatype;
      if (!cls || !cls.prototype) continue;
      const basePath = Reflect.getMetadata(PATH_METADATA, cls) ?? '';
      for (const name of allMethodNames(cls.prototype)) {
        const handler = cls.prototype[name];
        if (typeof handler !== 'function') continue;
        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        if (httpMethod === undefined) continue; // không phải route handler
        const path = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, cls]) === true;
        const raw = reflector.getAllAndOverride<string | string[]>(REQUIRE_PERM, [handler, cls]);
        const perms = raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw];
        // Tham số route lấy từ path THẬT mà Nest đăng ký (basePath cấp controller
        // + path cấp handler) — KHÔNG grep source, đúng nguyên tắc "hỏi DI
        // container" của cả file này (xem khối chú thích đầu file).
        const rawFullPath = `${String(basePath)}/${String(path)}`;
        // ⚠ Quy tắc này CHƯA kín, đừng đọc như đã kín (D-4 review cuối nhánh,
        // ghi ở docs/rewrite-spec/no-ky-thuat.md): (1) wildcard Express 4
        // (`@Get('download/*')`) KHÔNG mang tên `:` — params rỗng ⇒ route được
        // MIỄN @ScopedBy dù splat có định danh bản ghi; (2) route hai tham số
        // (`:cusId/items/:itemId`) chỉ cần MỘT @ScopedBy là lưới xanh, tham số
        // còn lại không ai đối chiếu (ScopedByEntity chưa có dạng "kiểm cả hai").
        // Không lối nào chạm tới được với 3 route hiện có; sẽ chạm khi #02/#05
        // lên. Ai thêm route kiểu đó: vá lưới TRƯỚC.
        const params = Array.from(rawFullPath.matchAll(/:([A-Za-z0-9_]+)/g)).map((m) => m[1]);
        const scopedBy = reflector.getAllAndOverride<ScopedByOptions | undefined>(SCOPED_BY, [handler, cls]);
        out.push({
          label: `${methodName(httpMethod)} /${String(basePath).replace(/^\//, '')}/${String(path).replace(/^\//, '')}`
            .replace(/\/+$/, '/')
            .replace(/\/{2,}/g, '/') + `  (${cls.name}.${name})`,
          isPublic,
          perms,
          params,
          scopedBy,
        });
      }
    }
  }
  return out;
}

let app: INestApplication;
beforeAll(async () => {
  app = await createApp();
  await app.init();
});
afterAll(async () => {
  await app.close();
});

it('kiểm kê route thấy được ÍT NHẤT các route đã biết — nếu con số này về 0 thì '
  + 'phép kiểm kê đã hỏng và ca dưới sẽ xanh một cách vô nghĩa', () => {
  expect(inventory(app).length).toBeGreaterThanOrEqual(3);
});

it('MỌI route đã đăng ký đều mang @Public() HOẶC @RequirePerm — không route nào '
  + 'lọt qua PermGuard nhờ nhánh `if (!need) return true`', () => {
  const ungated = inventory(app)
    .filter((h) => !h.isPublic && h.perms.length === 0)
    .map((h) => h.label);
  expect(ungated).toEqual([]);
});

it('route @Public() DUY NHẤT của app là POST /auth/login — mọi route công khai '
  + 'mới phải đi qua ca này một cách có chủ ý', () => {
  const publics = inventory(app).filter((h) => h.isPublic).map((h) => h.label.split('  (')[0]);
  expect(publics).toEqual(['POST /auth/login']);
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 2 (.superpowers/sdd/2026-09-24-perm-scope-plan/task-2-brief.md) —
// lưới kiểm kê ở trên đã ép mọi handler mang @Public() HOẶC @RequirePerm,
// nhưng KHÔNG bắt được lỗ mà @ScopedBy/ScopeGuard đóng (Task 1): một route
// mang @RequirePerm('wallet.view') hợp lệ vẫn để lọt ENUMERATION nếu tham số
// route (`:cusId`) không được đối chiếu phạm vi. Ca dưới đóng vòng lặp đó ở
// tầng TĨNH-nhưng-TỪ-APP-THẬT, cùng nguyên tắc với lưới @RequirePerm.
//
// "Tham số định danh bản ghi" là gì? Chọn quy tắc RỘNG NHẤT có thể: MỌI tham
// số route (`:bất-kỳ-tên-gì`) tính là định danh bản ghi, không lọc theo tên.
//   - Khớp cứng theo tên (`:id`/`:code`/`:cusId`…) bị NÉ dễ dàng — đổi tên
//     thành `:customerCode`/`:khId` là lọt qua lưới ngay lập tức, và đổi tên
//     tham số route là việc một PR có thể làm mà không ai để ý là nó vừa mở
//     một lỗ scope. Bài học "grep bỏ lọt biến thể cú pháp" ở đầu file này áp
//     dụng y hệt cho việc khớp THEO TÊN.
//   - Coi MỌI tham số là định danh bản ghi có thể sinh dương tính giả (tham
//     số phân trang/enum nằm trên path thay vì query — hiếm nhưng có thể).
//     Đây là lựa chọn CÓ CHỦ Ý: dương tính giả chỉ tốn của người viết ĐÚNG
//     MỘT dòng `@ScopedBy({ none: true, reason: '...' })`; âm tính giả (bỏ
//     lọt một route thật sự cần scope) làm lộ số liệu/bản ghi của khách khác
//     — hai chi phí không đối xứng, nên lưới phải thiên về false positive.
//
// Lối thoát @ScopedBy({ none: true, reason }) (xem scoped-by.decorator.ts)
// là hành động THẤY ĐƯỢC, không phải khoảng trống im lặng: (a) `reason` rỗng
// vẫn bị bắt đỏ như thiếu hẳn @ScopedBy — ca "opt-out rỗng" dưới đây khoá lại
// điều này; (b) danh sách route đang opt-out được so KHỚP ĐÚNG (giống cách
// file này đã khoá cứng danh sách @Public phía trên) — thêm một opt-out MỚI
// bắt buộc sửa chính test này, không lặng lẽ lọt qua review.
// ═══════════════════════════════════════════════════════════════════════════

/** true nếu route ĐÃ xử lý xong yêu cầu scope — hoặc có @ScopedBy đối chiếu
 * thật, hoặc opt-out CÓ lý do khác rỗng. */
function isScopeHandled(h: HandlerInfo): boolean {
  if (!h.scopedBy) return false;
  if ('none' in h.scopedBy && h.scopedBy.none === true) {
    return typeof h.scopedBy.reason === 'string' && h.scopedBy.reason.trim().length > 0;
  }
  // { entity, param, field }: KHÔNG đủ khi chỉ CÓ MẶT (D-2 review cuối nhánh).
  // `param` phải trỏ vào một tham số route CÓ THẬT, nếu không ScopeGuard nhận
  // `undefined` — trước khi vá D-1 thì đó là FAIL-OPEN (Prisma xoá key
  // undefined khỏi `where`, mất luôn vế định danh), sau khi vá là route CHẾT
  // IM LẶNG (404 mọi request, mà 404 ở nhánh này cố ý không mang thông tin).
  // Cả hai đều phải ĐỎ lúc build. Danh sách params đã tính sẵn ở dòng ~100 từ
  // path THẬT Nest đăng ký, không grep source.
  const param = (h.scopedBy as ScopedByEntity).param;
  return typeof param === 'string' && h.params.includes(param);
}

it('MỌI route có tham số route (định danh bản ghi theo quy ước RỘNG NHẤT — '
  + 'bất kỳ `:xxx` nào trên path) đều mang @ScopedBy hợp lệ hoặc opt-out có lý do — '
  + 'không route tương lai nào lặng lẽ thiếu đối chiếu phạm vi', () => {
  const unscoped = inventory(app)
    .filter((h) => h.params.length > 0)
    .filter((h) => !isScopeHandled(h))
    .map((h) => h.label);
  expect(unscoped).toEqual([]);
});

it('opt-out @ScopedBy({ none: true }) hiện tại đúng bằng DANH SÁCH RỖNG — '
  + 'thêm route opt-out mới bắt buộc sửa CHÍNH ca này, không được lặng lẽ', () => {
  const optOuts = inventory(app)
    .filter((h) => h.scopedBy && 'none' in h.scopedBy && h.scopedBy.none === true)
    .map((h) => h.label.split('  (')[0]);
  expect(optOuts).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// D-2 của review CUỐI nhánh feat/perm-scope — lưới từng chỉ kiểm SỰ CÓ MẶT
// của @ScopedBy, không kiểm NỘI DUNG. Chú thích biện minh ("Task 1 đã kiểm
// field/entity ở scope-guard.spec.ts") ĐÚNG với đúng hai route ví hiện có và
// SAI với mọi route tương lai: scope-guard.spec.ts chỉ lái hai route đó.
// Ghép với D-1, một `param` gõ sai đi qua CẢ HAI tấm lưới mà vẫn xanh.
// Nay `param` PHẢI nằm trong danh sách tham số route THẬT (đã tính sẵn ở
// HandlerInfo.params, lấy từ path Nest đăng ký).
//
// Sau khi vá D-1, một `param` sai KHÔNG còn mở lỗ scope nữa (guard 404 mọi
// request) — nhưng nó biến route thành CHẾT IM LẶNG: 404 không mang thông
// tin, đúng bằng thiết kế, nên không ai lần ra được. Hai chốt chặn này bù
// nhau: D-1 giữ an toàn lúc CHẠY, D-2 làm lỗi cấu hình ĐỎ lúc BUILD.
// ═══════════════════════════════════════════════════════════════════════════
function hi(over: Partial<HandlerInfo>): HandlerInfo {
  return { label: 'GET /x/:cusId  (X.y)', isPublic: false, perms: ['wallet.view'], params: ['cusId'], scopedBy: undefined, ...over };
}

it('D-2: @ScopedBy.param KHÔNG trỏ vào tham số route nào có thật -> lưới coi là CHƯA xử lý scope', () => {
  const h = hi({ scopedBy: { entity: 'customer', param: 'cusid', field: 'code' } }); // gõ nhầm hoa/thường
  expect(isScopeHandled(h)).toBe(false);
});

it('D-2 ĐỐI CHỨNG: param KHỚP tham số route thật -> lưới coi là ĐÃ xử lý', () => {
  const h = hi({ scopedBy: { entity: 'customer', param: 'cusId', field: 'code' } });
  expect(isScopeHandled(h)).toBe(true);
});

it('D-2: opt-out có lý do vẫn được chấp nhận dù không có param nào khớp (nhánh none đi đường riêng)', () => {
  const h = hi({ scopedBy: { none: true, reason: 'tham số là enum cố định' } });
  expect(isScopeHandled(h)).toBe(true);
});

// ═══════════════════════════════════════════════════════════════════════════
// D-3 — lỗ NẰM DƯỚI cả hai tấm lưới, có từ nhánh trước (@RequirePerm), Task 2
// kế thừa. inventory() duyệt `Object.getOwnPropertyNames(cls.prototype)`:
// MỘT tầng. MetadataScanner của Nest
// (node_modules/@nestjs/core/metadata-scanner.js:60-78) duyệt TOÀN BỘ chuỗi
// prototype bằng `do { ... } while ((prototype = Reflect.getPrototypeOf(
// prototype)) && prototype !== Object.prototype)`. ⇒ controller kế thừa một
// lớp cha có @Get(':id') PHỤC VỤ THẬT một route mà lưới trả về RỖNG cho nó:
// không @RequirePerm nên PermGuard rơi vào `if (!need.length) return true` và
// cho MỌI người đã đăng nhập đi qua, không @ScopedBy nên ScopeGuard bỏ qua.
// Hai lưới cùng xanh trên một route mở toang — đúng lớp lỗi "grep chỉ thấy
// cái mình nghĩ ra mẫu cho" ở đầu file, một tầng cao hơn.
//
// Fixture dưới đây KHÔNG nằm trong AppModule (app riêng, chỉ dựng trong ca
// test) nên không thêm route nào vào app thật.
// ═══════════════════════════════════════════════════════════════════════════
class ZzscopeBaseCrudController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }
}

@Controller('zzscope-thua-ke')
class ZzscopeChildController extends ZzscopeBaseCrudController {}

describe('D-3 — route thừa kế từ lớp cha', () => {
  let fixtureApp: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [ZzscopeChildController] }).compile();
    fixtureApp = mod.createNestApplication();
    await fixtureApp.init();
  });
  afterAll(async () => {
    await fixtureApp.close();
  });

  it('ĐỐI CHỨNG TRƯỚC TIÊN: Nest THỰC SỰ phục vụ route khai ở lớp CHA (lỗ này có thật, '
    + 'không phải giả thuyết) — nếu ca này đỏ thì cả nhóm D-3 vô nghĩa', async () => {
    await request(fixtureApp.getHttpServer()).get('/zzscope-thua-ke/ZZSCOPE_X').expect(200);
  });

  it('D-3: lưới kiểm kê THẤY route thừa kế đó', () => {
    const found = inventory(fixtureApp).map((h) => h.label.split('  (')[0]);
    expect(found).toEqual(['GET /zzscope-thua-ke/:id']);
  });

  it('D-3: và vì thế lưới @RequirePerm bắt ĐỎ nó (trước khi vá, danh sách rỗng = xanh giả trên route mở toang)', () => {
    const ungated = inventory(fixtureApp)
      .filter((h) => !h.isPublic && h.perms.length === 0)
      .map((h) => h.label.split('  (')[0]);
    expect(ungated).toEqual(['GET /zzscope-thua-ke/:id']);
  });

  it('D-3: và lưới @ScopedBy cũng bắt ĐỎ nó (route có `:id` mà không khai phạm vi)', () => {
    const unscoped = inventory(fixtureApp)
      .filter((h) => h.params.length > 0)
      .filter((h) => !isScopeHandled(h))
      .map((h) => h.label.split('  (')[0]);
    expect(unscoped).toEqual(['GET /zzscope-thua-ke/:id']);
  });
});
