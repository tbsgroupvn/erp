import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { Scope } from '@prisma/client';
import { createApp } from '../../src/main';
import { PermService } from '../../src/iam/perm.service';
import { prisma, resetIam, seedUser, seedRole, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';

// Task 5, PART A + PART B — CHỦ ĐÍCH dựng app qua createApp() (ĐÚNG entrypoint
// production dùng, xem src/main.ts), KHÔNG tự lắp lại Test.createTestingModule
// + app.useGlobalPipes(...) ở đây: nếu hardening (helmet/ValidationPipe) chỉ
// nằm trong bootstrap() mà không nằm trong createApp(), test tự chép lại cấu
// hình sẽ xanh trong khi production KHÔNG được hardening thật — đúng bẫy
// "bản sao logic không được vá theo" (MEMORY.md).
let app: INestApplication;
let jwtSvc: JwtService;

beforeAll(async () => {
  app = await createApp();
  await app.init();
  jwtSvc = app.get(JwtService);
});
// Task 1 (kế hoạch @RequirePerm nhận biết PHẠM VI) thêm ScopeGuard: từ nay
// mọi request qua được PermGuard còn phải khớp MỘT Customer.code = :cusId
// nằm trong phạm vi (kể cả scope 'all' — where rỗng vẫn đòi bản ghi TỒN TẠI).
// resetMasterdata() dọn tbl_customer mỗi ca, các ca dưới nào cần qua ScopeGuard
// (200/201) phải tự seedCustomer() khớp cusId đang gọi.
beforeEach(async () => { await resetIam(); await resetMasterdata(); });
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return jwtSvc.signAsync({ sub: user.id, username: user.username });
}

describe('PART A — gác quyền hai endpoint ví (trước đây ai có token hợp lệ cũng gọi được)', () => {
  it('GET số dư đòi quyền đọc ví — user KHÔNG có quyền gì bị 403', async () => {
    const u = await seedUser({ username: 'ZZAPI_saleThuong' });
    const t = await tokenFor(u);
    await request(app.getHttpServer())
      .get('/wallets/ZZAPI_wallet_demo/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('POST repair-cache đòi quyền CAO HƠN đọc — user KHÔNG có quyền gì bị 403', async () => {
    const u = await seedUser({ username: 'ZZAPI_saleThuong2' });
    const t = await tokenFor(u);
    await request(app.getHttpServer())
      .post('/wallets/ZZAPI_wallet_demo/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('CHỨNG MINH quyền ghi CAO HƠN quyền đọc: có wallet.view thì GET qua (200) nhưng '
    + 'repair-cache vẫn 403 — wallet.view KHÔNG ngầm định kéo theo wallet.repair', async () => {
    const u = await seedUser({ username: 'ZZAPI_walletViewer' });
    const r = await seedRole('zzapi-wallet-view-role', [{ code: 'wallet.view', scope: Scope.all }]);
    await assignRole(u.id, r.id);
    app.get(PermService).clearCache();
    // ScopeGuard (Task 1) đòi Customer.code = :cusId TỒN TẠI kể cả scope 'all'
    // (where rỗng vẫn cần bản ghi khớp) — seed khớp cusId đang gọi bên dưới.
    await seedCustomer('ZZAPI_wallet_demo', 'ZZAPI_walletViewer');
    const t = await tokenFor(u);

    const res = await request(app.getHttpServer())
      .get('/wallets/ZZAPI_wallet_demo/available')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
    // DTO layer (Task 3) — số VND ra STRING, không phải number thô.
    expect(res.body).toEqual({ balance: '0', available: '0' });

    await request(app.getHttpServer())
      .post('/wallets/ZZAPI_wallet_demo/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  // ═══ Ruling 4 của review CUỐI ═══════════════════════════════════════════
  // `wallet.controller.ts` KHẲNG ĐỊNH trong chú thích: "wallet.repair PHẢI là
  // quyền CAO HƠN wallet.view (không role nào có wallet.repair mà thiếu
  // wallet.view)". Trước 23/09/2026 đó là một QUY ƯỚC THIẾT KẾ VAI, không phải
  // mã: user chỉ có wallet.repair vẫn được 201. Và bộ test chỉ canh chiều ĐÃ
  // ĐÚNG SẴN (view không kéo theo repair), không canh chiều được khẳng định.
  //
  // Đã chọn ENFORCE (không phải xoá khẳng định): @RequirePerm nhận NHIỀU mã và
  // đòi ĐỦ CẢ. Lý do ở commit message + báo cáo — tóm tắt: "ghi-mà-không-đọc-
  // được" là một lỗ tách quyền thật (sửa sổ ví mà không được phép xem sổ), và
  // cơ chế nhiều-mã sẽ còn cần lại.
  it('CHIỀU ĐƯỢC KHẲNG ĐỊNH (trước đây KHÔNG ai kiểm): user có ĐÚNG wallet.repair '
    + 'mà THIẾU wallet.view bị 403 — repair không còn mạnh-chỉ-trên-danh-nghĩa', async () => {
    const u = await seedUser({ username: 'ZZAPI_walletRepairOnly' });
    const r = await seedRole('zzapi-wallet-repair-only-role', [{ code: 'wallet.repair', scope: Scope.all }]);
    await assignRole(u.id, r.id);
    app.get(PermService).clearCache();
    const t = await tokenFor(u);

    await request(app.getHttpServer())
      .post('/wallets/ZZAPI_wallet_demo_repair/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
  });

  it('đối chứng: có ĐỦ CẢ wallet.repair + wallet.view thì POST repair-cache qua được '
    + '(201) — chứng minh ca 403 phía trên do THIẾU wallet.view, không phải do repair '
    + 'bị chặn cứng', async () => {
    const u = await seedUser({ username: 'ZZAPI_walletRepairer' });
    const r = await seedRole('zzapi-wallet-repair-role', [
      { code: 'wallet.repair', scope: Scope.all },
      { code: 'wallet.view', scope: Scope.all },
    ]);
    await assignRole(u.id, r.id);
    app.get(PermService).clearCache();
    // ScopeGuard đòi Customer.code = :cusId tồn tại (xem ca phía trên).
    await seedCustomer('ZZAPI_wallet_demo_repair', 'ZZAPI_walletRepairer');
    const t = await tokenFor(u);

    const res = await request(app.getHttpServer())
      .post('/wallets/ZZAPI_wallet_demo_repair/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);
    expect(res.body).toEqual({ balance: '0' });
  });

  it('đủ quyền thì thân phản hồi là DTO chuỗi (VND là BigInt, không được ra number)', async () => {
    const u = await seedUser({ username: 'ZZAPI_walletRepairer2' });
    const r = await seedRole('zzapi-wallet-repair-role2', [
      { code: 'wallet.repair', scope: Scope.all },
      { code: 'wallet.view', scope: Scope.all },
    ]);
    await assignRole(u.id, r.id);
    app.get(PermService).clearCache();
    // ScopeGuard đòi Customer.code = :cusId tồn tại (xem ca đầu file).
    await seedCustomer('ZZAPI_wallet_demo_repair2', 'ZZAPI_walletRepairer2');
    const t = await tokenFor(u);

    const res = await request(app.getHttpServer())
      .post('/wallets/ZZAPI_wallet_demo_repair2/repair-cache')
      .set('Authorization', `Bearer ${t}`)
      .expect(201);
    expect(typeof res.body.balance).toBe('string');
  });
});

describe('PART B — bootstrap hardening thật sự sống trong createApp() (đo qua ĐÚNG entrypoint)', () => {
  it('helmet đã nối dây: x-powered-by KHÔNG còn xuất hiện', async () => {
    const res = await request(app.getHttpServer()).get('/wallets/ZZAPI_wallet_demo/available');
    expect(res.header['x-powered-by']).toBeUndefined();
  });

  it('helmet đã nối dây: có header X-Content-Type-Options: nosniff', async () => {
    const res = await request(app.getHttpServer()).get('/wallets/ZZAPI_wallet_demo/available');
    expect(res.header['x-content-type-options']).toBe('nosniff');
  });

  it('ValidationPipe toàn cục loại trường thừa thay vì nuốt im lặng (400, không phải 200/201 âm thầm bỏ field)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'a', password: 'b', isSuperAdmin: true })
      .expect(400);
  });
});
