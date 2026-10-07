import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalPendingHoldProvider } from './pending-approval-hold';

export interface IPendingHoldProvider {
  pendingHold(cusId: string, excludeRequestId?: number): Promise<bigint>;
}

@Injectable()
export class HoldService {
  private providers: IPendingHoldProvider[] = [];
  constructor(private prisma: PrismaService) {
    // Q7 — phiếu RÚT/PHÂN BỔ ví đang chờ duyệt GIỮ tiền (prod holdCalc). Đăng ký NGAY trong
    // constructor chứ không để module nào đó nhớ gọi register(): quên đăng ký = khách tiêu được
    // tiền đang chờ rút (lỗi tiêu hai lần). Mọi HoldService, kể cả dựng tay, đều có provider này.
    this.register(new ApprovalPendingHoldProvider(prisma));
  }

  register(p: IPendingHoldProvider) { this.providers.push(p); }

  async holdAmount(cusId: string, excludeRequestId?: number): Promise<bigint> {
    const c = (cusId ?? '').trim();
    if (!c) return 0n;
    const rows = await this.prisma.poReceipt.findMany({
      where: { customerId: c, method: 'wallet', status: 'no',
               ...(excludeRequestId
                 ? { OR: [{ allocRequestId: null }, { allocRequestId: { not: excludeRequestId } }] }
                 : {}) },
      select: { amount: true },
    });
    let hold = rows.reduce((s, r) => s + BigInt(Math.round(Number(r.amount))), 0n);
    for (const p of this.providers) hold += await p.pendingHold(c, excludeRequestId);
    return hold;
  }
}
