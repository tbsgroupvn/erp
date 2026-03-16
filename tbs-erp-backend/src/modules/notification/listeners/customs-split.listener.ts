import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

@Injectable()
export class CustomsSplitListener {
  private readonly logger = new Logger(CustomsSplitListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('customs.split.created')
  async handleCustomsSplit(event: {
    containerId: string;
    containerCode: string;
    heldPackageIds: string[];
    clearedCount: number;
    heldCount: number;
    reason: string;
    estimatedReleaseDate?: string;
    splitBy: string;
  }) {
    this.logger.log(
      `Customs split on container ${event.containerCode}: ${event.heldCount} held, ${event.clearedCount} cleared`,
    );

    // Query held packages to get order -> customer -> sale info
    const heldPackages = await this.prisma.package.findMany({
      where: { id: { in: event.heldPackageIds } },
      select: {
        id: true,
        code: true,
        order: {
          select: {
            id: true,
            code: true,
            saleId: true,
            customer: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    // Group by sale user to avoid duplicate notifications
    const salePackagesMap = new Map<string, { customerName: string; packageCodes: string[] }>();
    for (const pkg of heldPackages) {
      if (!pkg.order) continue;
      const saleId = pkg.order.saleId;
      const customerName = pkg.order.customer?.fullName ?? 'N/A';
      if (!salePackagesMap.has(saleId)) {
        salePackagesMap.set(saleId, { customerName, packageCodes: [] });
      }
      salePackagesMap.get(saleId)!.packageCodes.push(pkg.code);
    }

    // Notify each sale user
    const saleUserIds = [...salePackagesMap.keys()];
    if (saleUserIds.length > 0) {
      for (const [saleId, info] of salePackagesMap) {
        await this.notificationService.send({
          userId: saleId,
          title: 'Kien hang bi giu tai hai quan',
          body:
            `${info.packageCodes.length} kien cua KH ${info.customerName} bi giu tai hai quan. ` +
            `Container: ${event.containerCode}. Ly do: ${event.reason}`,
          type: 'CUSTOMS',
          referenceId: event.containerId,
          isUrgent: true,
        });
      }
    }

    // Notify XNK_MANAGER role
    await this.notificationService.sendToRole('XNK_MANAGER', {
      title: 'Container bi tach lo tai hai quan',
      body:
        `Container ${event.containerCode} bi tach lo: ${event.clearedCount} cleared, ${event.heldCount} held. ` +
        `Ly do: ${event.reason}`,
      type: 'CUSTOMS',
      referenceId: event.containerId,
      isUrgent: true,
    });

    // Notify WAREHOUSE_VN_MANAGER role
    await this.notificationService.sendToRole('WAREHOUSE_VN_MANAGER', {
      title: 'Chi nhan mot phan kien tu container',
      body:
        `Container ${event.containerCode}: chi co ${event.clearedCount} kien thong quan. ` +
        `${event.heldCount} kien bi giu lai.`,
      type: 'CUSTOMS',
      referenceId: event.containerId,
    });
  }

  @OnEvent('customs.hold.resolved')
  async handleCustomsHoldResolved(event: {
    containerId: string;
    containerCode: string;
    packageIds: string[];
    resolution: 'RELEASED' | 'CONFISCATED';
    remainingHeld: number;
    note?: string;
    resolvedBy: string;
  }) {
    this.logger.log(
      `Customs hold resolved on container ${event.containerCode}: ` +
        `${event.packageIds.length} ${event.resolution}, ${event.remainingHeld} remaining`,
    );

    // Query resolved packages to get sale info
    const packages = await this.prisma.package.findMany({
      where: { id: { in: event.packageIds } },
      select: {
        code: true,
        order: {
          select: {
            saleId: true,
            customer: { select: { fullName: true } },
          },
        },
      },
    });

    // Collect unique sale user IDs
    const saleIds = [...new Set(packages.map((p) => p.order?.saleId).filter(Boolean))] as string[];

    if (event.resolution === 'RELEASED') {
      if (saleIds.length > 0) {
        await this.notificationService.sendBulk(saleIds, {
          title: 'Kien hang da duoc thong quan',
          body:
            `${event.packageIds.length} kien tu container ${event.containerCode} da duoc tha. ` +
            `San sang nhan kho VN.${event.note ? ` Ghi chu: ${event.note}` : ''}`,
          type: 'CUSTOMS',
          referenceId: event.containerId,
        });
      }
    } else {
      // CONFISCATED
      if (saleIds.length > 0) {
        await this.notificationService.sendBulk(saleIds, {
          title: 'Kien hang bi tich thu boi hai quan',
          body:
            `${event.packageIds.length} kien tu container ${event.containerCode} bi tich thu. ` +
            `Don hang da chuyen trang thai ISSUE.${event.note ? ` Ghi chu: ${event.note}` : ''}`,
          type: 'CUSTOMS',
          referenceId: event.containerId,
          isUrgent: true,
        });
      }
    }
  }
}
