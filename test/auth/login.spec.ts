import { PrismaModule } from '../../src/prisma/prisma.module';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { prisma, resetIam } from '../helpers/iam-db';
import { AuthModule } from '../../src/auth/auth.module';
import { AuthController } from '../../src/auth/auth.controller';

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}
async function seedUser(opts: { username: string; password: string }) {
  return prisma.user.create({ data: { username: opts.username, password: opts.password, isActive: true } });
}

let app: INestApplication;
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, AuthModule] }).compile();
  app = mod.createNestApplication();
  // Cố ý KHÔNG gắn ValidationPipe toàn cục ở đây — pipe validate DTO phải nằm
  // NGAY TẠI controller (xem auth.controller.ts) để hành vi giống hệt production
  // dù main.ts có gọi useGlobalPipes hay không.
  await app.init();
});
beforeEach(resetIam);
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

it('login đúng mật khẩu trả access_token giải mã ra đúng uid', async () => {
  const u = await seedUser({ username: 'ZZAPI_ok', password: await hash('Matkhau@1') });
  const res = await request(app.getHttpServer())
    .post('/auth/login').send({ username: 'ZZAPI_ok', password: 'Matkhau@1' }).expect(201);
  expect(res.body.access_token).toBeDefined();
  const payload = jwt.verify(res.body.access_token, process.env.JWT_SECRET!) as any;
  expect(payload.sub).toBe(u.id);
});

it('sai mật khẩu KHÔNG trả token và KHÔNG nói rõ sai ở đâu', async () => {
  await seedUser({ username: 'ZZAPI_bad', password: await hash('Matkhau@1') });
  const res = await request(app.getHttpServer())
    .post('/auth/login').send({ username: 'ZZAPI_bad', password: 'sai' }).expect(401);
  expect(res.body.access_token).toBeUndefined();
  // Không được lộ "user tồn tại nhưng sai mật khẩu" vs "không có user"
  expect(JSON.stringify(res.body)).not.toMatch(/không tìm thấy|not found|no such user/i);
});

it('thân request thiếu trường bị chặn ở ValidationPipe, không chạm AuthService', async () => {
  await request(app.getHttpServer()).post('/auth/login').send({ username: 'x' }).expect(400);
});

// F-6: khoá tạm đã được NỐI DÂY, nhưng KHÔNG được biến thành kênh dò. HTTP phải
// trả y hệt nhánh sai mật khẩu — cùng mã, cùng thân phản hồi.
it('tài khoản BỊ KHOÁ trả 401 với THÂN PHẢN HỒI GIỐNG HỆT nhánh sai mật khẩu '
  + '(trạng thái khoá không được thành kênh dò)', async () => {
  const prev = process.env.LOGIN_MAX_FAIL_24H;
  process.env.LOGIN_MAX_FAIL_24H = '2';
  try {
    await seedUser({ username: 'ZZAPI_lock', password: await hash('Matkhau@1') });
    await seedUser({ username: 'ZZAPI_nolock', password: await hash('Matkhau@1') });
    const agent = request(app.getHttpServer());
    // Đẩy ZZAPI_lock qua ngưỡng
    for (let i = 0; i < 2; i++) {
      await agent.post('/auth/login').send({ username: 'ZZAPI_lock', password: 'sai' + i }).expect(401);
    }
    // Bị khoá: nhập ĐÚNG mật khẩu vẫn 401
    const locked = await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'ZZAPI_lock', password: 'Matkhau@1' }).expect(401);
    // Tài khoản khác, sai mật khẩu bình thường
    const wrong = await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'ZZAPI_nolock', password: 'sai' }).expect(401);
    expect(locked.body).toEqual(wrong.body);
  } finally {
    if (prev === undefined) delete process.env.LOGIN_MAX_FAIL_24H;
    else process.env.LOGIN_MAX_FAIL_24H = prev;
  }
});

it('đối chứng cho ca trên: CÙNG tài khoản ZZAPI_lock nhưng CHƯA qua ngưỡng thì '
  + 'mật khẩu đúng vẫn ra token — ca trên đỏ vì KHOÁ, không phải vì fixture', async () => {
  const prev = process.env.LOGIN_MAX_FAIL_24H;
  process.env.LOGIN_MAX_FAIL_24H = '2';
  try {
    await seedUser({ username: 'ZZAPI_lock', password: await hash('Matkhau@1') });
    await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'ZZAPI_lock', password: 'sai0' }).expect(401);
    const res = await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'ZZAPI_lock', password: 'Matkhau@1' }).expect(201);
    expect(res.body.access_token).toBeDefined();
  } finally {
    if (prev === undefined) delete process.env.LOGIN_MAX_FAIL_24H;
    else process.env.LOGIN_MAX_FAIL_24H = prev;
  }
});

// D3 — controller phải truyền ĐỊA CHỈ CỤC BỘ của kết nối (SERVER_ADDR của Apache) vào cổng tài
// khoản chỉ-nội-bộ. supertest luôn đi loopback nên gọi thẳng controller với req giả.
describe('D3 — controller truyền serverIp = socket.localAddress', () => {
  const fakeReq = (remote: string, local: string) =>
    ({ socket: { remoteAddress: remote, localAddress: local }, headers: {} });

  it('IP client == địa chỉ cục bộ của kết nối (máy chủ tự gọi vòng) ⇒ qa_goods ra token', async () => {
    await seedUser({ username: 'qa_goods', password: await hash('Matkhau@1') });
    const ctl = app.get(AuthController);
    const r = await ctl.login({ username: 'qa_goods', password: 'Matkhau@1' } as any,
      fakeReq('::ffff:203.0.113.5', '::ffff:203.0.113.5'));
    expect(r.access_token).toBeDefined();
  });

  it('đối chứng: IP client KHÁC địa chỉ cục bộ ⇒ qa_goods bị 401', async () => {
    await seedUser({ username: 'qa_goods', password: await hash('Matkhau@1') });
    const ctl = app.get(AuthController);
    await expect(ctl.login({ username: 'qa_goods', password: 'Matkhau@1' } as any,
      fakeReq('203.0.113.5', '203.0.113.6'))).rejects.toThrow(UnauthorizedException);
  });
});

// D7 — JWT phải mang username ĐÃ LƯU (mọi khoá nối submitted_by / saler / người duyệt dựa vào nó),
// không phải chuỗi người dùng gõ.
describe('D7 — JWT mang username đã lưu', () => {
  it("gõ 'lephuc' ⇒ token mang 'LePhuc'", async () => {
    await seedUser({ username: 'LePhuc', password: await hash('Matkhau@1') });
    const res = await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'lephuc', password: 'Matkhau@1' }).expect(201);
    expect((jwt.verify(res.body.access_token, process.env.JWT_SECRET!) as any).username).toBe('LePhuc');
  });

  it("gõ 'LePhuc ' (dấu cách cuối) ⇒ token mang 'LePhuc'", async () => {
    await seedUser({ username: 'LePhuc', password: await hash('Matkhau@1') });
    const res = await request(app.getHttpServer())
      .post('/auth/login').send({ username: 'LePhuc ', password: 'Matkhau@1' }).expect(201);
    expect((jwt.verify(res.body.access_token, process.env.JWT_SECRET!) as any).username).toBe('LePhuc');
  });
});

// I-1 — controller phải đưa gateIp() (fail-closed) vào cổng, không phải clientIp().
describe('I-1 — cổng nội bộ fail-closed sau reverse proxy cấu hình sai', () => {
  const ORIG = process.env.TRUSTED_PROXIES;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.TRUSTED_PROXIES;
    else process.env.TRUSTED_PROXIES = ORIG;
  });
  const proxied = (headers: Record<string, string>) =>
    ({ socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1' }, headers });

  it('(a) TRUSTED_PROXIES trống, nginx cùng máy chuyển tiếp client Internet ⇒ qa_goods bị 401', async () => {
    delete process.env.TRUSTED_PROXIES;
    await seedUser({ username: 'qa_goods', password: await hash('Matkhau@1') });
    await expect(app.get(AuthController).login({ username: 'qa_goods', password: 'Matkhau@1' } as any,
      proxied({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' }))).rejects.toThrow(UnauthorizedException);
  });

  it('(b) TRUSTED_PROXIES=127.0.0.1 nhưng proxy không gửi XFF ⇒ qa_goods bị 401', async () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    await seedUser({ username: 'qa_goods', password: await hash('Matkhau@1') });
    await expect(app.get(AuthController).login({ username: 'qa_goods', password: 'Matkhau@1' } as any,
      proxied({ 'x-real-ip': '203.0.113.9' }))).rejects.toThrow(UnauthorizedException);
  });

  it('đối chứng proxy ĐÚNG: máy chủ tự gọi qua proxy (XFF 127.0.0.1) ⇒ qa_goods ra token', async () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    await seedUser({ username: 'qa_goods', password: await hash('Matkhau@1') });
    const r = await app.get(AuthController).login({ username: 'qa_goods', password: 'Matkhau@1' } as any,
      proxied({ 'x-forwarded-for': '127.0.0.1' }));
    expect(r.access_token).toBeDefined();
  });

  it('đối chứng: tài khoản THƯỜNG ở cấu hình (a) vẫn ra token (cổng chỉ áp tài khoản nội bộ)', async () => {
    delete process.env.TRUSTED_PROXIES;
    await seedUser({ username: 'sale_i1', password: await hash('Matkhau@1') });
    const r = await app.get(AuthController).login({ username: 'sale_i1', password: 'Matkhau@1' } as any,
      proxied({ 'x-forwarded-for': '203.0.113.9' }));
    expect(r.access_token).toBeDefined();
  });
});
