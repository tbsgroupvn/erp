import { Controller, Get, INestApplication, Logger, Module, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createApp } from '../../src/main';
import { prisma, resetIam, seedUser } from '../helpers/iam-db';

// Route test-only để tạo lỗi THẬT (Prisma, không phải Error tự viết tay giả
// lập) đi qua ĐÚNG đường sản xuất: createApp() (src/main.ts) — cùng một hàm
// bootstrap() thật dùng, không phải bản test tự chép lại cấu hình filter.
// Nhờ vậy mutant "bỏ app.useGlobalFilters() khỏi main.ts" bị ca dưới bắt
// được thật sự, không phải ca "tự lắp filter riêng trong test" (loại test đó
// không đi qua nhánh cần canh — xem cảnh báo trong task-4-brief).
@Controller('zz-test')
class ZzBoomController {
  constructor(private prisma: PrismaService) {}

  // Bảng không tồn tại -> Prisma ném PrismaClientKnownRequestError THẬT, message
  // mang theo tên quan hệ + đoạn SQL — đúng loại rò rỉ filter phải chặn.
  @Get('boom')
  async boom() {
    return this.prisma.$queryRawUnsafe('SELECT * FROM zz_khong_ton_tai_xyz_boom');
  }

  // ⚠ Tái tạo ĐÚNG bẫy có thật trong BaseExceptionFilter mặc định của Nest
  // (node_modules/@nestjs/core/exceptions/base-exception-filter.js,
  // `isHttpError()`): bất kỳ object nào KHÔNG phải HttpException nhưng tình cờ
  // có sẵn field `.statusCode` (nhiều driver/thư viện gắn `.statusCode` cho
  // MỤC ĐÍCH KHÁC, không hề có ý định là mã HTTP) bị Nest mặc định duck-type
  // thành "http-error" và trả THẲNG `.message` ra client — không qua bước che
  // giấu nào. Route /boom (Prisma thật) KHÔNG tự lộ qua đường này vì
  // PrismaClientKnownRequestError không có `.statusCode` — filter của TA vẫn
  // cần chặn được ca này bằng `instanceof HttpException` (không duck-type)
  // thay vì tin theo hình dạng object.
  @Get('boom-leaky-shape')
  boomLeakyShape(): never {
    const e: any = new Error(
      'SQLSTATE[42P01] relation "tbl_wallet_detail" does not exist -- SELECT cus_id, so_tien FROM tbl_wallet_detail WHERE constraint fk_wallet_cusid_fkey violated',
    );
    e.statusCode = 500; // KHÔNG cố ý là mã HTTP — mô phỏng field trùng tên một số driver/lib gắn sẵn
    throw e;
  }

  // Đối chứng: HttpException CHỦ Ý phải đi qua NGUYÊN TRẠNG (status + message),
  // filter không được đụng vào loại này.
  @Get('http-error')
  httpError(): never {
    throw new NotFoundException('Không tìm thấy khách hàng ZZAPI-404-DEMO');
  }
}

@Module({ imports: [AppModule], controllers: [ZzBoomController], providers: [PrismaService] })
class ZzTestRootModule {}

let app: INestApplication;
let jwtSvc: JwtService;

beforeAll(async () => {
  app = await createApp(ZzTestRootModule);
  await app.init();
  jwtSvc = app.get(JwtService);
});
beforeEach(resetIam);
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function tokenFor(user: { id: number; username: string }) {
  return jwtSvc.signAsync({ sub: user.id, username: user.username });
}

describe('Global exception filter — chống rò rỉ chi tiết CSDL, giữ log server-side', () => {
  it('lỗi không lường trước -> HTTP 500 (không phải trang cụt/khác)', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy1' }));
    await request(app.getHttpServer()).get('/zz-test/boom')
      .set('Authorization', `Bearer ${t}`).expect(500);
  });

  it('lỗi không lường trước (Prisma thật) -> body KHÔNG chứa message/stack/chi tiết CSDL', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy2' }));
    const res = await request(app.getHttpServer()).get('/zz-test/boom')
      .set('Authorization', `Bearer ${t}`);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|relation|column|constraint|SELECT|stack|zz_khong_ton_tai/i);
  });

  it('lỗi không lường trước (Prisma thật) -> body KHÔNG có field "message" (chỉ status chung)', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy3' }));
    const res = await request(app.getHttpServer()).get('/zz-test/boom')
      .set('Authorization', `Bearer ${t}`);
    expect(res.body).not.toHaveProperty('message');
  });

  // Canary THẬT cho mutant "bỏ filter khỏi main.ts": route Prisma ở trên vô tình
  // AN TOÀN ngay cả KHÔNG có filter (PrismaClientKnownRequestError không có
  // `.statusCode` nên rớt vào nhánh generic mặc định của Nest) — không đủ để
  // canh việc gỡ filter. Route dưới đây (`.statusCode` tình cờ trùng field) mới
  // thật sự phân biệt được "có filter" / "không có filter": không có filter,
  // Nest tin theo hình dạng object và trả THẲNG message này ra client.
  it('lỗi dạng "trông giống http-error" (có sẵn .statusCode tình cờ) -> body VẪN KHÔNG lộ message/SQL', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy2b' }));
    const res = await request(app.getHttpServer()).get('/zz-test/boom-leaky-shape')
      .set('Authorization', `Bearer ${t}`);
    expect(JSON.stringify(res.body)).not.toMatch(/sqlstate|relation|tbl_wallet_detail|constraint|SELECT|fk_wallet/i);
  });

  it('lỗi dạng "trông giống http-error" -> vẫn HTTP 500, không phải mã tình cờ mang theo (.statusCode giả)', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy2c' }));
    await request(app.getHttpServer()).get('/zz-test/boom-leaky-shape')
      .set('Authorization', `Bearer ${t}`).expect(500);
  });

  it('lỗi không lường trước -> VẪN được ghi log server-side (không nuốt mất, mất log = mất khả năng gỡ lỗi)', async () => {
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as unknown as void);
    try {
      const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy4' }));
      await request(app.getHttpServer()).get('/zz-test/boom').set('Authorization', `Bearer ${t}`);
      expect(spy).toHaveBeenCalled();
      const loggedText = spy.mock.calls.map((c) => String(c[0]) + ' ' + String(c[1] ?? '')).join('\n');
      expect(loggedText).toMatch(/relation|zz_khong_ton_tai_xyz_boom/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('HttpException CHỦ Ý (vd lỗi nghiệp vụ 404) đi qua NGUYÊN TRẠNG status + message cho người gọi', async () => {
    const t = await tokenFor(await seedUser({ username: 'ZZAPI_errhy5' }));
    const res = await request(app.getHttpServer()).get('/zz-test/http-error')
      .set('Authorization', `Bearer ${t}`).expect(404);
    expect(JSON.stringify(res.body)).toMatch(/ZZAPI-404-DEMO/);
  });
});
