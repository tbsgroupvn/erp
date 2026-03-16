import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { ContainerStatus, TrackingEventType } from '@prisma/client';
import { ContainerStatusMachine } from './container-status.machine';
import { CustomsSplitDto, ResolveHeldPackagesDto } from '../dto/customs-split.dto';

@Injectable()
export class CustomsSplitService {
  private readonly logger = new Logger(CustomsSplitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statusMachine: ContainerStatusMachine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Split a container at customs: mark selected packages as held,
   * transition container to CUSTOMS_HOLD.
   */
  async splitAtCustoms(containerId: string, dto: CustomsSplitDto, userId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const container = await tx.container.findUnique({
        where: { id: containerId },
        include: { packages: { select: { id: true, code: true } } },
      });

      if (!container) {
        throw new NotFoundException(`Container ${containerId} not found`);
      }

      if (container.status !== ContainerStatus.CUSTOMS) {
        throw new BadRequestException(
          `Container must be in CUSTOMS status to split. Current: ${container.status}`,
        );
      }

      if (dto.heldPackageIds.length === 0) {
        throw new BadRequestException('Must specify at least one held package');
      }

      // Validate all held package IDs belong to this container
      const containerPackageIds = new Set(container.packages.map((p) => p.id));
      const invalidIds = dto.heldPackageIds.filter((id) => !containerPackageIds.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Packages not in this container: ${invalidIds.join(', ')}`,
        );
      }

      if (dto.heldPackageIds.length >= container.packages.length) {
        throw new BadRequestException(
          'Cannot hold all packages. Use container-level hold instead.',
        );
      }

      // Update held packages: set independentStatus = 'CUSTOMS_HELD'
      await tx.package.updateMany({
        where: { id: { in: dto.heldPackageIds } },
        data: { independentStatus: 'CUSTOMS_HELD' },
      });

      const clearedCount = container.packages.length - dto.heldPackageIds.length;
      const heldCount = dto.heldPackageIds.length;

      // Validate FSM transition
      this.statusMachine.assertTransition(container.status, ContainerStatus.CUSTOMS_HOLD);

      // Update container
      const updated = await tx.container.update({
        where: { id: containerId },
        data: {
          status: ContainerStatus.CUSTOMS_HOLD,
          clearedPackageCount: clearedCount,
          heldPackageCount: heldCount,
          customsHoldReason: dto.reason,
          customsHoldAt: new Date(),
        },
      });

      // Record tracking event
      await tx.trackingEvent.create({
        data: {
          containerId,
          eventType: TrackingEventType.CUSTOMS_SPLIT,
          eventTimestamp: new Date(),
          description: `Tach lo tai hai quan: ${clearedCount} cleared, ${heldCount} held. Ly do: ${dto.reason}`,
          location: 'Customs',
          createdBy: userId,
        },
      });

      this.logger.log(
        `Container ${container.code} split at customs: ${clearedCount} cleared, ${heldCount} held by ${userId}`,
      );

      // Emit event for notification listener
      this.eventEmitter.emit('customs.split.created', {
        containerId,
        containerCode: container.code,
        heldPackageIds: dto.heldPackageIds,
        clearedCount,
        heldCount,
        reason: dto.reason,
        estimatedReleaseDate: dto.estimatedReleaseDate,
        splitBy: userId,
      });

      return updated;
    });
  }

  /**
   * Resolve held packages: release or confiscate.
   * When all held packages are resolved, transition container to COMPLETED.
   */
  async resolveHeldPackages(containerId: string, dto: ResolveHeldPackagesDto, userId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const container = await tx.container.findUnique({
        where: { id: containerId },
      });

      if (!container) {
        throw new NotFoundException(`Container ${containerId} not found`);
      }

      if (container.status !== ContainerStatus.CUSTOMS_HOLD) {
        throw new BadRequestException(
          `Container must be in CUSTOMS_HOLD status. Current: ${container.status}`,
        );
      }

      // Validate packages are currently held
      const heldPackages = await tx.package.findMany({
        where: {
          id: { in: dto.packageIds },
          containerId,
          independentStatus: 'CUSTOMS_HELD',
        },
        select: { id: true, code: true, orderId: true },
      });

      if (heldPackages.length !== dto.packageIds.length) {
        const foundIds = new Set(heldPackages.map((p) => p.id));
        const missing = dto.packageIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Packages not in CUSTOMS_HELD status or not in this container: ${missing.join(', ')}`,
        );
      }

      if (dto.resolution === 'RELEASED') {
        // Clear independentStatus so they can be received at VN warehouse
        await tx.package.updateMany({
          where: { id: { in: dto.packageIds } },
          data: { independentStatus: null },
        });
      } else {
        // CONFISCATED
        await tx.package.updateMany({
          where: { id: { in: dto.packageIds } },
          data: { independentStatus: 'CONFISCATED_BY_CUSTOMS' },
        });

        // Update related orders to ISSUE status
        const orderIds = [...new Set(heldPackages.map((p) => p.orderId))];
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: 'ISSUE' as any },
        });
      }

      // Recalculate remaining held count
      const remainingHeld = await tx.package.count({
        where: {
          containerId,
          independentStatus: 'CUSTOMS_HELD',
        },
      });

      const updateData: any = {
        heldPackageCount: remainingHeld,
      };

      // If no more held packages, complete the container
      if (remainingHeld === 0) {
        this.statusMachine.assertTransition(container.status, ContainerStatus.COMPLETED);
        updateData.status = ContainerStatus.COMPLETED;
        updateData.customsHoldResolvedAt = new Date();
        updateData.customsClearedAt = new Date();
      }

      const updated = await tx.container.update({
        where: { id: containerId },
        data: updateData,
      });

      // Record tracking event
      await tx.trackingEvent.create({
        data: {
          containerId,
          eventType: TrackingEventType.CUSTOMS_HOLD_RESOLVED,
          eventTimestamp: new Date(),
          description:
            `${dto.packageIds.length} kien ${dto.resolution === 'RELEASED' ? 'duoc tha' : 'bi tich thu'}. ` +
            `Con lai ${remainingHeld} kien bi giu.${dto.note ? ` Ghi chu: ${dto.note}` : ''}`,
          location: 'Customs',
          createdBy: userId,
        },
      });

      this.logger.log(
        `Container ${container.code}: ${dto.packageIds.length} packages ${dto.resolution}. ` +
          `Remaining held: ${remainingHeld}`,
      );

      // Emit event for notification
      this.eventEmitter.emit('customs.hold.resolved', {
        containerId,
        containerCode: container.code,
        packageIds: dto.packageIds,
        resolution: dto.resolution,
        remainingHeld,
        note: dto.note,
        resolvedBy: userId,
      });

      return updated;
    });
  }

  /**
   * Get the customs split status for a container:
   * cleared, held, and confiscated packages grouped by customer.
   */
  async getContainerSplitStatus(containerId: string) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      select: {
        id: true,
        code: true,
        totalPackages: true,
        clearedPackageCount: true,
        heldPackageCount: true,
        customsHoldReason: true,
        customsHoldAt: true,
        customsHoldResolvedAt: true,
        status: true,
      },
    });

    if (!container) {
      throw new NotFoundException(`Container ${containerId} not found`);
    }

    const packages = await this.prisma.package.findMany({
      where: { containerId },
      select: {
        id: true,
        code: true,
        orderId: true,
        independentStatus: true,
        order: {
          select: {
            id: true,
            code: true,
            customer: {
              select: { id: true, fullName: true, code: true },
            },
          },
        },
      },
    });

    const clearedPackages = packages
      .filter((p) => !p.independentStatus || p.independentStatus === 'NORMAL')
      .map((p) => ({
        id: p.id,
        code: p.code,
        orderId: p.orderId,
        orderCode: p.order?.code ?? '',
        customerName: p.order?.customer?.fullName ?? '',
        independentStatus: p.independentStatus,
      }));

    const heldPackages = packages
      .filter((p) => p.independentStatus === 'CUSTOMS_HELD')
      .map((p) => ({
        id: p.id,
        code: p.code,
        orderId: p.orderId,
        orderCode: p.order?.code ?? '',
        customerName: p.order?.customer?.fullName ?? '',
        independentStatus: p.independentStatus,
      }));

    const confiscatedPackages = packages
      .filter((p) => p.independentStatus === 'CONFISCATED_BY_CUSTOMS')
      .map((p) => ({
        id: p.id,
        code: p.code,
        orderId: p.orderId,
        orderCode: p.order?.code ?? '',
        customerName: p.order?.customer?.fullName ?? '',
        independentStatus: p.independentStatus,
      }));

    return {
      containerId: container.id,
      containerCode: container.code,
      containerStatus: container.status,
      totalPackages: container.totalPackages,
      clearedPackages,
      heldPackages,
      confiscatedPackages,
      reason: container.customsHoldReason,
      holdAt: container.customsHoldAt?.toISOString() ?? null,
      resolvedAt: container.customsHoldResolvedAt?.toISOString() ?? null,
    };
  }
}
