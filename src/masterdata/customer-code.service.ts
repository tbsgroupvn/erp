import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_CUSTOMER_PREFIX = 'TBS';

@Injectable()
export class CustomerCodeService {
  constructor(private prisma: PrismaService) {}

  /** Số tiếp theo. Dùng SEQUENCE Postgres: nextval() KHÔNG bị rollback
   *  ⇒ số đã phát không bao giờ tái dùng (đúng luật bất biến "mã không tái dùng").
   *  Thay cho bảng vé INSERT-rồi-XOÁ của MySQL prod (includes/customer_create.php:22). */
  async nextNum(): Promise<number> {
    const r = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('customer_code_seq')`;
    return Number(r[0].nextval);
  }

  async next(prefix: string = DEFAULT_CUSTOMER_PREFIX): Promise<string> {
    return prefix + (await this.nextNum());
  }
}
