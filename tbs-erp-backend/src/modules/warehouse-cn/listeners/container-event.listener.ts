import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

export interface ContainerStatusChangedEvent {
  containerId: string;
  containerCode: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  shippingRoute: string;
}

export interface ContainerDepartedEvent {
  containerId: string;
  containerCode: string;
  shippingRoute: string;
}

/**
 * Listens for container events that affect Warehouse CN operations.
 *
 * - When a container starts LOADING, mark associated packages as ready for loading
 * - When a container departs (IN_TRANSIT), update all packages to SHIPPED status
 */
@Injectable()
export class ContainerEventListener {
  private readonly logger = new Logger(ContainerEventListener.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * When a container transitions to IN_TRANSIT (departed from CN),
   * update all packages in the container to SHIPPED status.
   */
  @OnEvent('container.departed')
  async handleContainerDeparted(
    event: ContainerDepartedEvent,
  ): Promise<void> {
    this.logger.log(
      `Container ${event.containerCode} has departed via ${event.shippingRoute}. ` +
        `Updating package statuses to SHIPPED.`,
    );

    try {
      const result = await this.prisma.package.updateMany({
        where: {
          containerId: event.containerId,
          warehouseCNStatus: { in: ['PACKED', 'CHECKED'] },
        },
        data: {
          warehouseCNStatus: 'SHIPPED',
        },
      });

      this.logger.log(
        `Updated ${result.count} packages to SHIPPED for container ${event.containerCode}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update packages for container ${event.containerCode}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * When a container status changes, log for warehouse dashboard tracking.
   */
  @OnEvent('container.status.changed')
  async handleContainerStatusChanged(
    event: ContainerStatusChangedEvent,
  ): Promise<void> {
    this.logger.log(
      `Container ${event.containerCode} status: ${event.fromStatus} -> ${event.toStatus}`,
    );

    // When container starts loading, we could trigger notifications
    // to warehouse agents about which packages to prepare
    if (event.toStatus === 'LOADING') {
      const packages = await this.prisma.package.findMany({
        where: {
          containerId: event.containerId,
          warehouseCNStatus: 'PACKED',
        },
        select: { id: true, code: true },
      });

      this.logger.log(
        `Container ${event.containerCode} is loading. ` +
          `${packages.length} packages ready for loading.`,
      );
    }
  }
}
