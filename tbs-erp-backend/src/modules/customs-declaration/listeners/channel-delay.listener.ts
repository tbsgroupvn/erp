import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '@modules/notification/notification.service';
import { UserRole } from '@prisma/client';

/**
 * Listens for customs channel assignment events and monitors channel delays.
 *
 * Channel notification rules:
 *  - GREEN: No special notification needed
 *  - YELLOW: Notify XNK_MANAGER and sale owners of affected orders
 *  - RED: Notify XNK_MANAGER, sale owners, AND COO (physical inspection required)
 *
 * Delay monitoring (cron every 4 hours):
 *  - YELLOW channel > 48 hours since assignment: emit delay notification
 *  - RED channel > 72 hours since assignment: emit delay notification
 */
@Injectable()
export class ChannelDelayListener {
  private readonly logger = new Logger(ChannelDelayListener.name);

  /** Maximum hours before a YELLOW channel is considered delayed */
  private readonly YELLOW_DELAY_HOURS = 48;

  /** Maximum hours before a RED channel is considered delayed */
  private readonly RED_DELAY_HOURS = 72;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Handles customs channel assignment events.
   *
   * Notifies relevant stakeholders based on the assigned channel color:
   *  - YELLOW/RED: XNK_MANAGER + sale owners of affected orders
   *  - RED only: also COO
   */
  @OnEvent('customs.channel.assigned')
  async handleChannelAssigned(event: {
    declarationId: string;
    channel: string;
    containerId: string;
  }): Promise<void> {
    this.logger.log(`Channel assigned: ${event.channel} for declaration ${event.declarationId}`);

    // GREEN channel requires no special notification
    if (event.channel === 'GREEN') {
      return;
    }

    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: event.declarationId },
      select: { code: true, containerId: true },
    });

    if (!declaration) return;

    // Find sale owners of affected orders via container
    const saleOwnerIds = await this.getSaleOwnerIds(event.containerId);

    // Find XNK_MANAGER users
    const xnkManagers = await this.prisma.user.findMany({
      where: { role: UserRole.XNK_MANAGER, isActive: true },
      select: { id: true },
    });

    const channelLabel = event.channel === 'YELLOW' ? 'VANG' : 'DO';
    const urgencyNote =
      event.channel === 'RED' ? ' Hang hoa can kiem tra thuc te.' : ' Hang hoa can kiem tra ho so.';

    // Notify XNK managers
    for (const manager of xnkManagers) {
      await this.notificationService.send({
        userId: manager.id,
        title: `To khai ${declaration.code} - Luong ${channelLabel}`,
        body: `To khai hai quan ${declaration.code} da duoc phan luong ${channelLabel}.${urgencyNote}`,
        type: 'CUSTOMS',
        referenceId: event.declarationId,
        isUrgent: event.channel === 'RED',
      });
    }

    // Notify sale owners
    for (const saleId of saleOwnerIds) {
      await this.notificationService.send({
        userId: saleId,
        title: `To khai ${declaration.code} - Luong ${channelLabel}`,
        body:
          `To khai hai quan ${declaration.code} da duoc phan luong ${channelLabel}. ` +
          `Don hang cua ban co the bi anh huong ve thoi gian giao hang.`,
        type: 'CUSTOMS',
        referenceId: event.declarationId,
      });
    }

    // If RED channel, also notify COO
    if (event.channel === 'RED') {
      const cooUsers = await this.prisma.user.findMany({
        where: { role: UserRole.COO, isActive: true },
        select: { id: true },
      });

      for (const coo of cooUsers) {
        await this.notificationService.send({
          userId: coo.id,
          title: `[KHAN CAP] To khai ${declaration.code} - Luong DO`,
          body:
            `To khai hai quan ${declaration.code} da duoc phan luong DO (kiem tra thuc te). ` +
            `Vui long theo doi va chi dao xu ly.`,
          type: 'CUSTOMS',
          referenceId: event.declarationId,
          isUrgent: true,
        });
      }
    }

    this.logger.log(
      `Notifications sent for ${event.channel} channel assignment on declaration ${declaration.code}`,
    );
  }

  /**
   * Cron job: checks for customs declarations stuck in CHANNEL_ASSIGNED or
   * INSPECTING status beyond the allowed timeframes.
   *
   * Runs every 4 hours.
   */
  @Cron('0 */4 * * *')
  async checkChannelDelays(): Promise<void> {
    const now = new Date();

    // Find declarations in CHANNEL_ASSIGNED or INSPECTING status
    const declarations = await this.prisma.customsDeclaration.findMany({
      where: {
        status: { in: ['CHANNEL_ASSIGNED', 'INSPECTING'] },
        channel: { in: ['YELLOW', 'RED'] },
        channelAssignedAt: { not: null },
      },
      select: {
        id: true,
        code: true,
        channel: true,
        channelAssignedAt: true,
        containerId: true,
        status: true,
      },
    });

    for (const decl of declarations) {
      if (!decl.channelAssignedAt) continue;

      const hoursElapsed = (now.getTime() - decl.channelAssignedAt.getTime()) / (1000 * 60 * 60);

      const isDelayed =
        (decl.channel === 'YELLOW' && hoursElapsed > this.YELLOW_DELAY_HOURS) ||
        (decl.channel === 'RED' && hoursElapsed > this.RED_DELAY_HOURS);

      if (!isDelayed) continue;

      const channelLabel = decl.channel === 'YELLOW' ? 'VANG' : 'DO';
      const maxHours = decl.channel === 'YELLOW' ? this.YELLOW_DELAY_HOURS : this.RED_DELAY_HOURS;

      this.logger.warn(
        `Declaration ${decl.code} (${channelLabel}) has been in ${decl.status} ` +
          `for ${Math.round(hoursElapsed)}h (limit: ${maxHours}h)`,
      );

      // Notify XNK managers about the delay
      const xnkManagers = await this.prisma.user.findMany({
        where: { role: UserRole.XNK_MANAGER, isActive: true },
        select: { id: true },
      });

      for (const manager of xnkManagers) {
        await this.notificationService.send({
          userId: manager.id,
          title: `[TRE HAN] To khai ${decl.code} - Luong ${channelLabel}`,
          body:
            `To khai ${decl.code} da o trang thai ${decl.status} ` +
            `qua ${Math.round(hoursElapsed)} gio (vuot qua ${maxHours} gio). ` +
            `Vui long kiem tra va xu ly.`,
          type: 'CUSTOMS',
          referenceId: decl.id,
          isUrgent: true,
        });
      }

      // Notify sale owners of affected orders
      const saleOwnerIds = await this.getSaleOwnerIds(decl.containerId);
      for (const saleId of saleOwnerIds) {
        await this.notificationService.send({
          userId: saleId,
          title: `To khai ${decl.code} bi tre`,
          body:
            `To khai hai quan ${decl.code} dang bi tre xu ly (${Math.round(hoursElapsed)} gio). ` +
            `Don hang cua ban co the bi anh huong.`,
          type: 'CUSTOMS',
          referenceId: decl.id,
        });
      }
    }

    if (declarations.length > 0) {
      this.logger.log(
        `Channel delay check completed. Checked ${declarations.length} declaration(s).`,
      );
    }
  }

  /**
   * Gets unique sale owner IDs for all orders in a container.
   */
  private async getSaleOwnerIds(containerId: string): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: { containerId },
      select: { saleId: true },
    });

    const saleIds = new Set<string>();
    for (const order of orders) {
      if (order.saleId) {
        saleIds.add(order.saleId);
      }
    }

    return Array.from(saleIds);
  }
}
