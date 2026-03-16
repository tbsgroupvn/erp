import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus, UserRole } from '@prisma/client';

export type HandoffType = 'STAGE_TRANSITION' | 'REASSIGNMENT' | 'ESCALATION';

export interface RecordHandoffParams {
  orderId: string;
  fromStage: OrderStatus;
  toStage: OrderStatus;
  fromDepartment: string;
  toDepartment: string;
  fromUserId?: string | null;
  toUserId?: string | null;
  toRole: UserRole;
  handoffType?: HandoffType;
  note?: string;
  /** Duration in minutes that the previous stage took */
  durationMinutes?: number;
}

/**
 * HandoffTrackerService records every time an order responsibility changes hands,
 * whether due to a stage transition, manual reassignment, or escalation.
 *
 * The handoff log provides a full audit trail of who handled what and for how long.
 */
@Injectable()
export class HandoffTrackerService {
  private readonly logger = new Logger(HandoffTrackerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a handoff event for an order.
   */
  async recordHandoff(params: RecordHandoffParams): Promise<string> {
    const {
      orderId,
      fromStage,
      toStage,
      fromDepartment,
      toDepartment,
      fromUserId,
      toUserId,
      toRole,
      handoffType = 'STAGE_TRANSITION',
      note,
      durationMinutes,
    } = params;

    const handoff = await this.prisma.orderHandoff.create({
      data: {
        orderId,
        fromStage,
        toStage,
        fromDepartment,
        toDepartment,
        fromUserId: fromUserId ?? null,
        toUserId: toUserId ?? null,
        toRole,
        handoffType,
        note: note ?? null,
        durationMinutes: durationMinutes ?? null,
      },
    });

    this.logger.debug(
      `Handoff recorded: order=${orderId} ${fromStage}->${toStage} ${fromDepartment}->${toDepartment} type=${handoffType}`,
    );

    return handoff.id;
  }

  /**
   * Returns handoffs for an order, newest first.
   */
  async getHandoffsForOrder(orderId: string) {
    return this.prisma.orderHandoff.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Computes the duration in minutes between the assignment creation time and now,
   * to use when recording a handoff on stage transition.
   */
  computeDuration(assignedAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - assignedAt.getTime();
    return Math.round(diffMs / 60000);
  }
}
