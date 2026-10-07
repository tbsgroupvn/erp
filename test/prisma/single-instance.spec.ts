import { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/main';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IamModule } from '../../src/iam/iam.module';
import { MoneyModule } from '../../src/money/money.module';
import { PoModule } from '../../src/po/po.module';
import { QuoteModule } from '../../src/quote/quote.module';
import { WarehouseModule } from '../../src/warehouse/warehouse.module';
import { CustomsModule } from '../../src/customs/customs.module';
import { ApprovalModule } from '../../src/approval/approval.module';
import { MasterDataModule } from '../../src/masterdata/masterdata.module';
import { WalletService } from '../../src/money/wallet.service';
import { PermService } from '../../src/iam/perm.service';
import { PoService } from '../../src/po/po.service';

/**
 * Cả ứng dụng phải dùng CHUNG MỘT `PrismaService`.
 *
 * ⚠ Trước 24/09/2026 mỗi module tự khai `PrismaService` trong `providers` của
 * mình. Trong Nest, provider khai ở module nào thì **sinh một instance riêng cho
 * module đó** — 8 module ⇒ **8 instance ⇒ 8 connection pool**. Prisma mặc định
 * mở `num_cpus * 2 + 1` kết nối mỗi pool; trên máy 16 CPU là 33/pool ⇒ tới
 * **264 kết nối** trong khi Postgres `max_connections` mặc định là **100**.
 * Và không instance nào được `$disconnect()`.
 *
 * ⚠⚠ Phép đo bằng `grep "new PrismaClient()"` KHÔNG thấy lỗi này — cả repo chỉ
 * có ĐÚNG MỘT chỗ gọi `new`, trong định nghĩa class. Phép nhân instance xảy ra
 * qua **đăng ký DI**, không qua từ khoá `new`. Đó là lý do ca test này hỏi
 * **container đang chạy** (`app.select(...).get(...)`) chứ không quét mã nguồn.
 */
describe('PrismaService dùng chung toàn ứng dụng', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  const modules = [
    ['IamModule', IamModule],
    ['MoneyModule', MoneyModule],
    ['PoModule', PoModule],
    ['QuoteModule', QuoteModule],
    ['WarehouseModule', WarehouseModule],
    ['CustomsModule', CustomsModule],
    ['ApprovalModule', ApprovalModule],
    ['MasterDataModule', MasterDataModule],
  ] as const;

  // ⚠⚠ `{ strict: true }` là BẮT BUỘC, không phải cho chặt chẽ.
  // `app.select(M).get(X)` mặc định `strict: false` ⇒ Nest tìm khắp container
  // chứ KHÔNG chỉ trong module đã chọn, nên nó luôn trả về cùng một instance và
  // ca test XANH kể cả khi mỗi module thật sự có instance riêng. Bản đầu của ca
  // này thiếu cờ đó, XANH ngay từ trước khi vá — một lưới tự mù. Chỉ phát hiện
  // vì "xanh" là kết quả đáng ngờ ở thời điểm chưa sửa gì.
  it('KHÔNG module nghiệp vụ nào tự khai PrismaService trong providers', () => {
    // `strict: true` chỉ tìm trong providers CỦA CHÍNH module. Provider toàn cục
    // KHÔNG nằm ở đó ⇒ đúng thì phải NÉM. Module nào trả về được instance tức là
    // nó có bản riêng ⇒ thêm một connection pool.
    const tuKhai = modules
      .filter(([, M]) => {
        try {
          app.select(M as any).get(PrismaService, { strict: true });
          return true;
        } catch {
          return false;
        }
      })
      .map(([ten]) => ten);
    expect(tuKhai).toEqual([]);
  });

  it('service thật trong các module giữ ĐÚNG instance toàn cục', () => {
    // Vế mạnh hơn ca trên: không chỉ "không ai khai riêng", mà dây nối thật sự
    // trỏ vào cùng một đối tượng. Không có ca này thì một cách nối sai khác
    // (vd provider tùy biến) vẫn lọt.
    const goc = app.get(PrismaService);
    const lech = [
      ['WalletService', WalletService],
      ['PermService', PermService],
      ['PoService', PoService],
    ]
      .filter(([, S]) => (app.get(S as any) as any).prisma !== goc)
      .map(([ten]) => ten);
    expect(lech).toEqual([]);
  });
});
