import { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/main';

// ═══════════════════════════════════════════════════════════════════════════
// F-5 của review CUỐI nhánh feat/api-dot1 — CỬA SAU `x-uid`.
//
// `PermGuard` (src/iam/perm.guard.ts) nhận header `x-uid` làm DANH TÍNH khi
// `process.env.NODE_ENV === 'test'`. Hôm nay KHÔNG khai thác được — `x-uid`
// chỉ được đọc khi `req.user` vắng mặt, mà `JwtAuthGuard` chạy trước nên điều
// đó chỉ xảy ra trên route `@Public()`, và route `@Public()` duy nhất trong
// src/ (`POST /auth/login`) không có `@RequirePerm`.
//
// Nhưng: `@Public()` LÀ lối mở được khuyến khích và có ghi tài liệu. Một route
// `@Public()` + `@RequirePerm` trong tương lai (kiểu "endpoint công khai nhưng
// có giới hạn") mở thẳng cửa sau đó. Và KHÔNG CÓ ĐƯỜNG NÀO trong mã production
// đặt NODE_ENV: `npm run start:prod` là `node dist/main` trần, `src/main.ts`
// không đọc cũng không khẳng định gì về nó. Giá trị hoàn toàn do môi trường —
// một container mang NODE_ENV=test chép từ image CI là đủ.
//
// Cách bịt: MÁY CHỦ THẬT TỪ CHỐI KHỞI ĐỘNG dưới danh tính test. Muốn boot với
// NODE_ENV=test thì phải nói ra bằng ALLOW_TEST_IDENTITY_BYPASS=1 — một biến
// không ai đặt nhầm, và chỉ test/helpers/jest-setup-env.js đặt.
//
// Ca canary + ca ĐỐI CHỨNG đi thành cặp: ca đối chứng chứng minh canary thật
// sự phân biệt được cờ, chứ không phải luôn luôn ném lỗi vì lý do khác.
// ═══════════════════════════════════════════════════════════════════════════

const FLAG = 'ALLOW_TEST_IDENTITY_BYPASS';
const ORIGINAL = process.env[FLAG];
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env[FLAG];
  else process.env[FLAG] = ORIGINAL;
});

it('NODE_ENV=test + KHÔNG có cờ đồng ý -> createApp() TỪ CHỐI khởi động', async () => {
  expect(process.env.NODE_ENV).toBe('test'); // tiền đề: jest đặt sẵn
  delete process.env[FLAG];
  await expect(createApp()).rejects.toThrow(/NODE_ENV/);
});

it('đối chứng: CÙNG NODE_ENV=test nhưng CÓ cờ đồng ý thì boot bình thường — '
  + 'chứng minh ca trên phân biệt được cờ, không phải luôn luôn ném lỗi', async () => {
  process.env[FLAG] = '1';
  let app: INestApplication | undefined;
  try {
    app = await createApp();
    expect(app).toBeDefined();
  } finally {
    await app?.close();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// I-1 — NODE_ENV=production mà KHÔNG khai TRUSTED_PROXIES ⇒ TỪ CHỐI KHỞI ĐỘNG. Cảnh báo log cũ bị
// bỏ qua được; triển khai dự kiến (aaPanel/nginx cùng máy) đúng là cấu hình làm mọi request thành
// 127.0.0.1. Chạy thẳng ra Internet không proxy thì khai tường minh TRUSTED_PROXIES=none.
// ═══════════════════════════════════════════════════════════════════════════
describe('I-1 — production bắt buộc khai TRUSTED_PROXIES', () => {
  const ENV0 = process.env.NODE_ENV;
  const TP0 = process.env.TRUSTED_PROXIES;
  afterEach(() => {
    process.env.NODE_ENV = ENV0;
    if (TP0 === undefined) delete process.env.TRUSTED_PROXIES; else process.env.TRUSTED_PROXIES = TP0;
  });

  it('NODE_ENV=production + TRUSTED_PROXIES trống ⇒ createApp() TỪ CHỐI', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUSTED_PROXIES;
    await expect(createApp()).rejects.toThrow(/TRUSTED_PROXIES/);
  });

  it.each(['none', '127.0.0.1'])('đối chứng: NODE_ENV=production + TRUSTED_PROXIES=%s ⇒ boot bình thường', async (v) => {
    process.env.NODE_ENV = 'production';
    process.env.TRUSTED_PROXIES = v;
    let app: INestApplication | undefined;
    try {
      app = await createApp();
      expect(app).toBeDefined();
    } finally { await app?.close(); }
  });

  // N-2: `start:prod` là `node dist/main` trần, không gì trong repo đặt NODE_ENV ⇒ chỉ chặn khi
  // NODE_ENV=production là chặn một biến không ai đặt. Chỉ miễn khi NÓI RA là test/development.
  it.each([undefined, '', 'staging', 'prod'])('NODE_ENV=%s + TRUSTED_PROXIES trống ⇒ TỪ CHỐI', async (env) => {
    if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    delete process.env.TRUSTED_PROXIES;
    await expect(createApp()).rejects.toThrow(/TRUSTED_PROXIES/);
  });

  it('đối chứng: NODE_ENV=development + TRUSTED_PROXIES trống ⇒ boot bình thường', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TRUSTED_PROXIES;
    let app: INestApplication | undefined;
    try {
      app = await createApp();
      expect(app).toBeDefined();
    } finally { await app?.close(); }
  });

  // N-1 (vế khởi động): clientIp()/gateIp() so khớp ĐỊA CHỈ ĐƠN LẺ, không hiểu CIDR/`loopback` như
  // proxy-addr của Express ⇒ khai dạng đó là hai bên lệch nhau và cổng hiểu sai. Chỉ nhận IP trần.
  it.each(['loopback', '127.0.0.0/8', '127.0.0.1,uniquelocal', 'localhost', '127.0.0.1;::1'])(
    'TRUSTED_PROXIES=%s (không phải IP trần) ⇒ TỪ CHỐI', async (v) => {
      process.env.NODE_ENV = 'production';
      process.env.TRUSTED_PROXIES = v;
      await expect(createApp()).rejects.toThrow(/TRUSTED_PROXIES/);
    });

  it('đối chứng: nhiều IP trần có khoảng trắng + ::ffff: ⇒ boot bình thường', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUSTED_PROXIES = '127.0.0.1, ::1, ::ffff:10.0.0.5';
    let app: INestApplication | undefined;
    try {
      app = await createApp();
      expect(app).toBeDefined();
    } finally { await app?.close(); }
  });
});
