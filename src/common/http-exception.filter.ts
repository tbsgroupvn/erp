import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

// Lưới AN TOÀN CUỐI CÙNG cho MỌI lỗi không được controller/service tự bắt.
//
// HttpException (NotFoundException, ForbiddenException, lỗi nghiệp vụ tự
// `throw new XxxException('...')`...) đã được VIẾT CÓ CHỦ Ý — message dành
// cho người gọi đọc. Loại này đi qua NGUYÊN TRẠNG (giữ status + message).
//
// Bất cứ thứ gì KHÁC (Prisma ném exception thật, TypeError, lỗi lập trình
// chưa lường trước) có khả năng mang theo tên bảng/cột/constraint/đoạn SQL
// trong `.message` — dồn hết về MỘT thân 500 chung, KHÔNG message/stack/
// name/mã lỗi Prisma. Không tự đoán "trông giống HttpException" (vd object
// có sẵn `.statusCode`) — chỉ tin `instanceof HttpException`, tránh lọt lưới
// qua một object giả dạng.
//
// VẪN PHẢI LOG đủ chi tiết ở server — nuốt luôn lỗi thật là mất khả năng gỡ
// lỗi ở production, một kiểu hỏng khác chứ không phải an toàn hơn (xem yêu
// cầu Task 4, PART A).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    // Không import type Request/Response từ 'express' ở đây — cùng lựa chọn với
    // src/common/client-ip.ts, tránh kéo thêm phụ thuộc chỉ để đọc vài field.
    const res: any = ctx.getResponse();
    const req: any = ctx.getRequest();

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const err: any = exception;
    this.logger.error(
      `${req?.method ?? '?'} ${req?.originalUrl ?? req?.url ?? '?'} -> ${err?.message ?? String(err)}`,
      err?.stack,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, error: 'Internal Server Error' });
  }
}
