import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { isIP } from 'net';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { trustedProxies as readTrustedProxies } from './common/client-ip';

// Tách khỏi bootstrap() thật (app.listen + lắng nghe cổng) để test dựng ĐÚNG
// cùng một khối cấu hình (helmet + ValidationPipe toàn cục + trust proxy +
// filter lỗi toàn cục) mà production dùng, thay vì tự chép lại — chép lại là
// đúng bẫy "bản sao logic không được vá theo" (MEMORY.md): sửa ở đây mà quên
// sửa bản chép trong test là vá nửa vời. Tham số `module` cho
// error-hygiene.spec.ts nạp thêm route test-only (/zz-test/boom) mà không
// phải sửa AppModule thật.
//
// Task 5 PART B: helmet()/disable x-powered-by/ValidationPipe(forbidNonWhitelisted)
// PHẢI nằm NGAY TRONG createApp() (không phải chỉ trong bootstrap() bên dưới)
// — test/auth/wallet-endpoints.spec.ts boot app qua chính createApp() này để
// canh đúng thứ production thật sự chạy, không phải một bản dựng lại trong test.
export async function createApp(module: any = AppModule): Promise<INestApplication> {
  // ⛔ F-5 (review cuối nhánh feat/api-dot1): `PermGuard` nhận header `x-uid` làm
  // DANH TÍNH khi NODE_ENV==='test'. Không có đường nào trong mã production đặt
  // NODE_ENV — `npm run start:prod` là `node dist/main` trần — nên giá trị đó hoàn
  // toàn do môi trường quyết định, và một container mang NODE_ENV=test chép từ image
  // CI là đủ để chạy máy chủ THẬT với cổng danh tính bằng header đang mở. Hôm nay
  // chưa khai thác được (x-uid chỉ được đọc khi req.user vắng, tức chỉ trên route
  // @Public(), mà route @Public() duy nhất không có @RequirePerm) — nhưng @Public()
  // chính là lối mở được khuyến khích, nên "hôm nay chưa" không phải một chốt chặn.
  //
  // ⇒ Máy chủ thật TỪ CHỐI KHỞI ĐỘNG dưới danh tính test. Muốn boot NODE_ENV=test
  // thì phải nói ra tường minh; test/helpers/jest-setup-env.js là chỗ DUY NHẤT đặt
  // cờ này. Ném ở đây (không phải chỉ cảnh báo) vì đây là cửa BỎ QUA XÁC THỰC.
  if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_IDENTITY_BYPASS !== '1') {
    throw new Error(
      'TỪ CHỐI KHỞI ĐỘNG: NODE_ENV=test bật cổng danh tính qua header x-uid trong '
      + 'PermGuard (bỏ qua xác thực JWT). Nếu đây thật sự là môi trường test, đặt '
      + 'ALLOW_TEST_IDENTITY_BYPASS=1. Nếu đây là máy chủ thật, BỎ NODE_ENV=test đi.',
    );
  }
  // ⛔ I-1 (review cuối fix/auth-fidelity): production PHẢI khai topo proxy. Thiếu TRUSTED_PROXIES
  // sau reverse proxy CÙNG MÁY (triển khai dự kiến: aaPanel/nginx) ⇒ mọi request thành 127.0.0.1 ⇒
  // cổng tài khoản chỉ-nội-bộ (siêu quản trị, vai quản trị) mở cho Internet. gateIp() đã fail-closed
  // khi proxy gửi X-Forwarded-For/X-Real-IP/Forwarded, nhưng proxy KHÔNG gửi header nào thì tầng ứng
  // dụng không phân biệt được với gọi cục bộ thật ⇒ chỉ còn cách buộc khai. Cảnh báo log (bản cũ) bỏ
  // qua được; từ chối khởi động thì không. Chạy thẳng ra Internet: TRUSTED_PROXIES=none.
  // N-2 (re-review): chỉ miễn khi NÓI RA là test/development. Bản trước chỉ chặn khi
  // NODE_ENV=production — mà `start:prod` là `node dist/main` trần, không gì trong repo đặt
  // NODE_ENV ⇒ chặn một biến không ai đặt = không chặn gì.
  const tpRaw = (process.env.TRUSTED_PROXIES ?? '').trim();
  const env = process.env.NODE_ENV;
  if (!tpRaw && env !== 'test' && env !== 'development') {
    throw new Error(
      `TỪ CHỐI KHỞI ĐỘNG: chưa khai TRUSTED_PROXIES (NODE_ENV=${env ?? '<trống>'}). Có reverse proxy `
      + '(nginx…) ⇒ TRUSTED_PROXIES=<IP proxy, vd 127.0.0.1,::1>. Node nhận thẳng từ Internet ⇒ '
      + 'TRUSTED_PROXIES=none. Máy lập trình ⇒ NODE_ENV=development.',
    );
  }
  // N-1 (re-review): clientIp()/gateIp() so khớp ĐỊA CHỈ ĐƠN LẺ; Express (proxy-addr) thì hiểu
  // CIDR/`loopback`/`uniquelocal`. Khai dạng đó là hai bên hiểu khác nhau ⇒ chỉ nhận IP trần hoặc `none`.
  if (tpRaw) {
    const bad = tpRaw.split(',').map((s) => s.trim())
      .filter((s) => s.toLowerCase() !== 'none' && !isIP(s.startsWith('::ffff:') ? s.slice(7) : s));
    if (bad.length) {
      throw new Error(
        `TỪ CHỐI KHỞI ĐỘNG: TRUSTED_PROXIES chỉ nhận IP trần phân tách bằng dấu phẩy (hoặc none); `
        + `không hợp lệ: ${bad.map((s) => JSON.stringify(s)).join(', ')}. Không dùng CIDR/loopback/tên máy.`,
      );
    }
  }
  const app = await NestFactory.create(module);
  // Bộ header bảo mật chuẩn (X-Content-Type-Options, X-Frame-Options, ẩn kỹ
  // thuật ngăn xếp…) — cài từ Task 1 nhưng cố tình CHƯA nối dây tới giờ.
  app.use(helmet());
  // Xoá header `X-Powered-By: Express` — khỏi lộ framework/tech stack cho dò quét.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // forbidNonWhitelisted là phần MẤU CHỐT: field lạ trong body (vd
  // `isSuperAdmin: true` chèn thêm) phải bị TỪ CHỐI 400, không phải bị
  // `whitelist` âm thầm cắt bỏ rồi request vẫn chạy tiếp — cắt lặng lẽ che mất
  // một caller đang thử chèn field không nên chèn.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Đồng bộ với src/common/client-ip.ts: CẢ HAI đọc CHUNG một biến TRUSTED_PROXIES.
  //
  // ⚠ ĐÍNH CHÍNH 23/09/2026 (F-1 của review cuối nhánh feat/api-dot1). Chú thích cũ ở
  // đây khẳng định "req.ip và clientIp() KHÔNG BAO GIỜ lệch nhau". Điều đó SAI, và sai
  // theo hướng nguy hiểm vì nó mời người đọc sau dùng lẫn lộn hai giá trị:
  //   - `proxy-addr` của Express bỏ qua các hop tin cậy tính TỪ PHẢI SANG rồi dừng ở
  //     hop đầu tiên không tin cậy;
  //   - `clientIp()` (sau bản vá F-1) cũng duyệt phải-sang-trái, nhưng chỉ tin XFF khi
  //     CHÍNH socket peer nằm trong danh sách, và so khớp bằng ĐỊA CHỈ ĐƠN LẺ (không
  //     hiểu CIDR/`loopback`/`linklocal` như proxy-addr).
  // Hai thuật toán GẦN nhau nhưng KHÔNG đồng nhất: khai TRUSTED_PROXIES theo dải CIDR
  // là chúng lệch ngay. Toàn hệ CHỈ đọc `clientIp()`; `req.ip` không được dùng ở đâu.
  // Ai định đọc `req.ip` phải đọc lại đoạn này trước.
  // Dùng CHUNG bộ đọc với clientIp()/gateIp() (hiểu `none`, gỡ ::ffff:) — không chép lại.
  const trustedProxies = readTrustedProxies();
  // Không cấu hình ⇒ XFF bị bỏ qua hoàn toàn và mọi request resolve ra socket peer.
  // Đứng sau reverse proxy CÙNG MÁY thì socket peer là 127.0.0.1 cho MỌI request trên
  // đời, và `isFromServerItself()` (src/iam/internal-accounts.ts) coi 127.0.0.1 là NỘI BỘ ⇒ cổng chặn tài khoản
  // ZZ* đăng nhập từ ngoài thành vô hiệu, `tbl_login_log` ghi đúng một địa chỉ. Không
  // có cách nào ở tầng ứng dụng tự biết có proxy hay không, nên: KÊU TO lúc khởi động.
  if (!trustedProxies.length) {
    new Logger('bootstrap').warn(
      'TRUSTED_PROXIES chưa đặt — X-Forwarded-For bị BỎ QUA, IP client = địa chỉ TCP '
      + 'của kết nối. ĐÚNG khi Node nhận thẳng từ Internet. Nếu có reverse proxy đứng '
      + 'trước, PHẢI đặt TRUSTED_PROXIES=<IP proxy>, nếu không mọi request sẽ được ghi '
      + 'nhận là 127.0.0.1 và cổng chặn tài khoản nội bộ (ZZ*) mất tác dụng.',
    );
  }
  // Dùng getHttpAdapter() thay vì NestExpressApplication để không đổi type của `app`
  // (tránh kéo theo sửa mọi nơi khác đang giữ INestApplication).
  if (trustedProxies.length) app.getHttpAdapter().getInstance().set('trust proxy', trustedProxies);
  // Chặn RÒ RỈ chi tiết lỗi (tên bảng/cột/constraint/SQL của Prisma, stack…) ra
  // client khi có lỗi KHÔNG lường trước — xem src/common/http-exception.filter.ts.
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}
// Chỉ tự chạy khi main.ts là ENTRYPOINT thật (node chạy trực tiếp file này qua
// `nest start`) — KHÔNG chạy khi bị `import`/`require` (vd test import
// `createApp` từ file này). Thiếu chặn này, mọi test import main.ts sẽ vô tình
// mở thật một server lắng nghe cổng ngay lúc nạp module.
if (require.main === module) bootstrap();
