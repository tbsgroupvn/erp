import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * MỘT `PrismaService` duy nhất cho cả ứng dụng.
 *
 * ⚠⚠ Vì sao `@Global()`: trong Nest, provider khai trong `providers` của module
 * nào thì **sinh instance riêng cho module đó**. Trước 24/09/2026, cả 8 module
 * nghiệp vụ đều tự khai `PrismaService` ⇒ **8 instance ⇒ 8 connection pool**.
 * Prisma mặc định mở `num_cpus * 2 + 1` kết nối mỗi pool; máy 16 CPU là 33/pool
 * ⇒ tới **264 kết nối** trong khi Postgres `max_connections` mặc định **100**.
 * Không instance nào được `$disconnect()`.
 *
 * ⚠ Phép đo bằng `grep "new PrismaClient()"` KHÔNG thấy lỗi này: cả repo chỉ có
 * ĐÚNG MỘT chỗ gọi `new`, trong định nghĩa class. Phép nhân instance xảy ra qua
 * **đăng ký DI**, không qua từ khoá `new`. Lưới canh là
 * `test/prisma/single-instance.spec.ts`, và nó hỏi **container đang chạy** chứ
 * không quét mã nguồn.
 *
 * ⇒ Module nghiệp vụ **KHÔNG được** khai lại `PrismaService` trong `providers`.
 * Khai lại là lập tức có thêm một pool, và lưới trên sẽ đỏ.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
