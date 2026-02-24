import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@core/database/prisma.service';

export interface OperationCostRecordedEvent {
  costId: string;
  containerId: string;
  containerCode: string;
  costType: string;
  amount: number;
}

/**
 * Listens for operation-cost.recorded events and automatically
 * triggers cost allocation based on the container's configured allocation method.
 */
@Injectable()
export class CostEnteredListener {
  private readonly logger = new Logger(CostEnteredListener.name);

  constructor(
    @InjectQueue('finance-events') private readonly financeQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('operation-cost.recorded')
  async handleCostCreated(event: OperationCostRecordedEvent) {
    const container = await this.prisma.container.findUnique({
      where: { id: event.containerId },
      select: { id: true, code: true, allocationMethod: true },
    });

    if (!container) {
      this.logger.warn(
        `Container ${event.containerId} not found — skipping auto-allocation for cost ${event.costId}`,
      );
      return;
    }

    this.logger.log(
      `Auto-allocating cost ${event.costId} for container ${container.code} using method ${container.allocationMethod}`,
    );

    try {
      await this.financeQueue.add(
        'cost-allocation',
        {
          costId: event.costId,
          containerId: event.containerId,
          containerCode: container.code,
          allocationMethod: container.allocationMethod ?? 'WEIGHT',
          amount: event.amount,
        },
        {
          jobId: `cost-alloc-${event.costId}`,
        },
      );

      this.logger.log(
        `Cost allocation job enqueued for container ${container.code} (cost ${event.costId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue cost allocation for container ${container.code}: ${error.message}`,
        error.stack,
      );
    }
  }
}
