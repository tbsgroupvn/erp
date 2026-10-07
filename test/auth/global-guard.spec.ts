import { PrismaModule } from '../../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Scope } from '@prisma/client';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AuthModule } from '../../src/auth/auth.module';
import { MoneyModule } from '../../src/money/money.module';
import { IamModule } from '../../src/iam/iam.module';
import { PermService } from '../../src/iam/perm.service';
import { RequirePerm } from '../../src/iam/require-perm.decorator';
import { Public } from '../../src/auth/public.decorator';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';

// Controller demo CHỈ để canh đúng chuỗi JwtAuthGuard -> PermGuard (giống mẫu
// test/iam/guard.e2e.spec.ts). KHÔNG dùng route wallet thật cho ca 403: đến lúc
// viết task này, `WalletController` (src/money/wallet.controller.ts) CHƯA có
// @RequirePerm trên bất kỳ handler nào — gắn nó là việc của Task 5 (hard
// constraint của task 1 cấm đụng src/money/). Đo thật (xem task-1-report.md,
// mục "Phát hiện lệch brief"): user có token hợp lệ + 0 quyền gọi
// GET /wallets/TBS4125/available hiện trả 200 {"balance":"0","available":"0"},
// không phải 403 — vì PermGuard mở cửa ngay khi không có @RequirePerm
// (`if (!need) return true`). Route thật vẫn dùng cho 3 ca 401 dưới đây vì đó
// đúng là hành vi tầng xác thực mà Task 1 phải đóng.
//
// QUAN TRỌNG: controller demo này KHÔNG có @UseGuards(PermGuard) riêng — chỉ có
// @RequirePerm. PermGuard áp dụng vào route này THUẦN qua APP_GUARD toàn cục mà
// AuthModule đăng ký. Lúc đầu bản nháp có gắn thêm @UseGuards(PermGuard) cục bộ,
// và nó che mất đúng lỗi thứ tự guard cần bắt: guard cục bộ LUÔN chạy SAU toàn bộ
// guard toàn cục (bất kể 2 guard toàn cục đăng ký theo thứ tự nào), nên đảo thứ tự
// APP_GUARD vẫn không làm ca 403 đỏ. Bỏ @UseGuards cục bộ + thêm ca "đủ quyền -> 200"
// bên dưới mới thật sự phân biệt được 2 thứ tự.
@Controller('zzapi-demo')
class DemoPermController {
  @Get('needs-perm') @RequirePerm('zzapi.demo.view')
  get() { return { ok: true }; }

  // @Public() làm JwtAuthGuard trả true ngay (bỏ qua xác thực JWT) NÊN req.user KHÔNG
  // bao giờ được set qua route này — đây là cách DUY NHẤT trong app THẬT (2 guard toàn
  // cục nối tiếp) để PermGuard chạm được nhánh x-uid của nó: nếu route có JwtAuthGuard
  // thật sự chạy (không @Public), thiếu Bearer token đã bị chặn 401 TRƯỚC KHI PermGuard
  // kịp đọc x-uid — mutant xoá cổng NODE_ENV bị "nuốt mất" bởi 401 đó, xem ca dưới.
  @Public() @Get('public-needs-perm') @RequirePerm('zzapi.demo.view')
  publicGet() { return { ok: true }; }
}

// F-4 (review CUỐI): hai guard đọc metadata KHÔNG đối xứng — `JwtAuthGuard` dùng
// `getAllAndOverride(IS_PUBLIC, [handler, class])` nên @Public() chạy được ở cấp
// LỚP, còn `PermGuard` chỉ đọc `get(REQUIRE_PERM, handler)` nên @RequirePerm ở
// cấp LỚP biên dịch trót lọt, chạy trót lọt, và GÁC ĐÚNG SỐ KHÔNG. Route rơi
// thẳng vào `if (!need) return true`. Controller này viết đúng cái kiểu mà
// @Public() dạy người ta rằng hệ thống chấp nhận.
@Controller('zzapi-demo-class')
@RequirePerm('zzapi.demo.view')
class DemoClassPermController {
  @Get('inherits')
  get() { return { ok: true }; }
}

let app: INestApplication; let jwtSvc: JwtService;
beforeAll(async () => {
  const mod = await Test.createTestingModule({
    // IamModule đứng CHUNG cấp với DemoPermController ở đây để PermService (dependency
    // của PermGuard) resolve được trong root module — xem chú thích trong iam.module.ts.
    imports: [PrismaModule, AuthModule, MoneyModule, IamModule],
    controllers: [DemoPermController, DemoClassPermController],
  }).compile();
  app = mod.createNestApplication();
  await app.init();
  jwtSvc = mod.get(JwtService);
});
beforeEach(resetIam);
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return jwtSvc.signAsync({ sub: user.id, username: user.username });
}

it('endpoint KHÔNG có @Public và KHÔNG có token bị chặn 401', async () => {
  await request(app.getHttpServer()).get('/wallets/TBS4125/available').expect(401);
});

it('token hợp lệ nhưng THIẾU quyền vẫn bị chặn 403', async () => {
  const t = await tokenFor(await seedUser({ username: 'ZZAPI_noperm' }));
  await request(app.getHttpServer())
    .get('/zzapi-demo/needs-perm')
    .set('Authorization', `Bearer ${t}`)
    .expect(403);
});

it('token hợp lệ VÀ ĐỦ quyền thì cho qua 200 — canary trực tiếp cho thứ tự guard: '
  + 'nếu PermGuard chạy TRƯỚC JwtAuthGuard, req.user vẫn undefined lúc PermGuard đọc '
  + 'nên fail-closed 403 dù user CÓ quyền; ca "thiếu quyền -> 403" ở trên không phân '
  + 'biệt được điều này vì cả hai thứ tự cùng ra 403 (chỉ khác lý do)', async () => {
  const u = await seedUser({ username: 'ZZAPI_hasperm' });
  const r = await seedRole('zzapi-demo-role', [{ code: 'zzapi.demo.view', scope: Scope.all }]);
  await assignRole(u.id, r.id);
  app.get(PermService).clearCache();
  const t = await tokenFor(u);
  await request(app.getHttpServer())
    .get('/zzapi-demo/needs-perm')
    .set('Authorization', `Bearer ${t}`)
    .expect(200);
});

it('token giả chữ ký bị chặn 401', async () => {
  const fake = jwt.sign({ sub: 1 }, 'khoa-sai');
  await request(app.getHttpServer())
    .get('/wallets/TBS4125/available')
    .set('Authorization', `Bearer ${fake}`)
    .expect(401);
});

it('x-uid KHÔNG qua mặt được guard khi NODE_ENV khác test', async () => {
  // PermGuard cố tình nhận x-uid chỉ khi NODE_ENV==='test'. Ca này khoá hành vi đó lại.
  // (Route /wallets/.../available không có @RequirePerm nên PermGuard mở cửa ngay —
  // 401 ở đây đến từ JwtAuthGuard vì thiếu Bearer token, KHÔNG phải từ cổng x-uid của
  // PermGuard. Vẫn là một khẳng định thật và đáng giữ: x-uid không thể dùng để bỏ qua
  // xác thực JWT trên route thật. Ca canary CHO ĐÚNG cổng x-uid của PermGuard nằm ở
  // test ngay dưới đây, trên route @Public()+@RequirePerm.)
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await request(app.getHttpServer()).get('/wallets/TBS4125/available').set('x-uid', '1').expect(401);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

it('x-uid canary THẬT: route @Public()+@RequirePerm (JwtAuthGuard không set req.user) '
  + 'vẫn KHÔNG cho x-uid qua mặt PermGuard khi NODE_ENV khác test', async () => {
  const u = await seedUser({ username: 'ZZAPI_xuid' });
  const r = await seedRole('zzapi-demo-role-xuid', [{ code: 'zzapi.demo.view', scope: Scope.all }]);
  await assignRole(u.id, r.id);
  app.get(PermService).clearCache();
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    // Không gửi Authorization — chỉ x-uid trỏ tới user CÓ quyền. Guard phải fail-closed (403).
    await request(app.getHttpServer())
      .get('/zzapi-demo/public-needs-perm')
      .set('x-uid', String(u.id))
      .expect(403);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

it('đối chứng: CÙNG ca trên nhưng NODE_ENV=test thì x-uid được chấp nhận -> 200 '
  + '(chứng minh ca canary phía trên thật sự phân biệt được NODE_ENV, không phải luôn luôn 403)', async () => {
  const u = await seedUser({ username: 'ZZAPI_xuid2' });
  const r = await seedRole('zzapi-demo-role-xuid2', [{ code: 'zzapi.demo.view', scope: Scope.all }]);
  await assignRole(u.id, r.id);
  app.get(PermService).clearCache();
  await request(app.getHttpServer())
    .get('/zzapi-demo/public-needs-perm')
    .set('x-uid', String(u.id))
    .expect(200);
});

it('@RequirePerm ở cấp LỚP phải GÁC THẬT: user thiếu quyền bị 403 '
  + '(trước F-4, PermGuard chỉ đọc metadata của HANDLER nên route này trả 200)', async () => {
  // ⚠⚠ clearCache() BẮT BUỘC ở ca "KHÔNG có quyền" này, không chỉ ở ca có quyền:
  // resetIam() TRUNCATE ... RESTART IDENTITY nên user mới lại nhận id=1, và nó
  // tạo lại perm_cfg.version='1' ⇒ KHOÁ CACHE của PermService (`uid@version`)
  // TRÙNG Y HỆT giữa các ca. Không xoá cache, user "trắng quyền" này ăn phải
  // bản ghi quyền của ca TRƯỚC (cùng id=1, có zzapi.demo.view) ⇒ 200. Đo thật:
  // ca này từng đỏ "expected 403, got 200" CẢ SAU KHI đã vá PermGuard — nguyên
  // nhân là cache, không phải guard.
  const t = await tokenFor(await seedUser({ username: 'ZZAPI_classNoperm' }));
  app.get(PermService).clearCache();
  await request(app.getHttpServer())
    .get('/zzapi-demo-class/inherits')
    .set('Authorization', `Bearer ${t}`)
    .expect(403);
});

it('đối chứng cho ca trên: CÙNG route cấp-lớp nhưng user ĐỦ quyền thì 200 — '
  + 'chứng minh ca 403 phía trên phân biệt được quyền, không phải luôn luôn 403', async () => {
  const u = await seedUser({ username: 'ZZAPI_classHasperm' });
  const r = await seedRole('zzapi-demo-class-role', [{ code: 'zzapi.demo.view', scope: Scope.all }]);
  await assignRole(u.id, r.id);
  app.get(PermService).clearCache();
  const t = await tokenFor(u);
  await request(app.getHttpServer())
    .get('/zzapi-demo-class/inherits')
    .set('Authorization', `Bearer ${t}`)
    .expect(200);
});
