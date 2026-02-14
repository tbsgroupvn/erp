import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateLostItemDto } from './dto/create-lost-item.dto';
import { LostAndFoundQueryDto } from './dto/lost-and-found-query.dto';

/** Retention period in days before items can be marked for disposal. */
const RETENTION_DAYS = 30;

@Injectable()
export class LostAndFoundService {
  private readonly logger = new Logger(LostAndFoundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers an unmatched/unidentified package.
   */
  async createLostItem(dto: CreateLostItemDto, userId: string) {
    const code = await this.generateCode();

    const item = await this.prisma.lostAndFound.create({
      data: {
        code,
        trackingNumber: dto.trackingNumber,
        description: dto.description,
        weight: dto.weight ? new Decimal(dto.weight) : null,
        warehouse: dto.warehouse,
        imageUrls: dto.photoUrls ?? [],
        status: 'UNIDENTIFIED',
        receivedBy: userId,
        createdAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
      },
    });

    this.eventEmitter.emit('lost-and-found.created', {
      itemId: item.id,
      code: item.code,
      trackingNumber: dto.trackingNumber,
      warehouse: dto.warehouse,
    });

    this.logger.log(`Lost item ${code} registered at warehouse ${dto.warehouse}`);

    return item;
  }

  /**
   * Lists lost and found items with pagination and filters.
   */
  async findAll(query: LostAndFoundQueryDto) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.warehouse) where.warehouse = query.warehouse;

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { trackingNumber: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lostAndFound.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
      }),
      this.prisma.lostAndFound.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Re-attempts matching the item against pre-alerts and orders.
   */
  async attemptMatch(id: string) {
    const item = await this.prisma.lostAndFound.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Lost item ${id} not found.`);
    }

    if (item.status !== 'UNIDENTIFIED') {
      throw new BadRequestException(
        `Item is in status ${item.status}. Only UNIDENTIFIED items can be matched.`,
      );
    }

    // Attempt matching by tracking number
    const matches: any[] = [];

    if (item.trackingNumber) {
      // Check pre-alerts
      const preAlerts = await this.prisma.preAlert.findMany({
        where: {
          trackingNumber: item.trackingNumber,
          status: 'WAITING',
        },
        take: 5,
      });

      if (preAlerts.length > 0) {
        matches.push(
          ...preAlerts.map((pa) => ({
            type: 'PRE_ALERT',
            id: pa.id,
            customerId: pa.customerId,
            trackingNumber: pa.trackingNumber,
            orderId: pa.orderId,
          })),
        );
      }

      // Check packages by CN tracking number
      const packages = await this.prisma.package.findMany({
        where: {
          trackingNumberCN: item.trackingNumber,
        },
        include: {
          order: { select: { id: true, code: true, customerId: true } },
        },
        take: 5,
      });

      if (packages.length > 0) {
        matches.push(
          ...packages.map((pkg) => ({
            type: 'PACKAGE',
            id: pkg.id,
            code: pkg.code,
            orderId: pkg.order.id,
            orderCode: pkg.order.code,
            customerId: pkg.order.customerId,
          })),
        );
      }
    }

    this.logger.log(
      `Match attempt for ${item.code}: found ${matches.length} potential matches`,
    );

    return {
      itemId: id,
      code: item.code,
      trackingNumber: item.trackingNumber,
      matchesFound: matches.length,
      matches,
    };
  }

  /**
   * Customer claims the lost item.
   */
  async claimItem(id: string, customerId: string, orderId?: string) {
    const item = await this.prisma.lostAndFound.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Lost item ${id} not found.`);
    }

    if (item.status !== 'UNIDENTIFIED') {
      throw new BadRequestException(
        `Item is in status ${item.status}. Only UNIDENTIFIED items can be claimed.`,
      );
    }

    const updated = await this.prisma.lostAndFound.update({
      where: { id },
      data: {
        status: 'CLAIMED',
        claimedBy: customerId,
        claimedAt: new Date(),
      },
    });

    this.eventEmitter.emit('lost-and-found.claimed', {
      itemId: id,
      code: item.code,
      customerId,
      orderId,
    });

    this.logger.log(`Lost item ${item.code} claimed by customer ${customerId}`);

    return updated;
  }

  /**
   * Marks an item for disposal after retention period.
   */
  async markForDisposal(id: string, reason: string) {
    const item = await this.prisma.lostAndFound.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Lost item ${id} not found.`);
    }

    if (item.status !== 'UNIDENTIFIED') {
      throw new BadRequestException(
        `Item is in status ${item.status}. Only UNIDENTIFIED items can be disposed.`,
      );
    }

    // Check retention period
    const daysSinceReceived = Math.floor(
      (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceReceived < RETENTION_DAYS) {
      throw new BadRequestException(
        `Item must be held for at least ${RETENTION_DAYS} days before disposal. Current: ${daysSinceReceived} days.`,
      );
    }

    const updated = await this.prisma.lostAndFound.update({
      where: { id },
      data: {
        status: 'DISPOSED',
        description: `${item.description ?? ''}\nDisposal reason: ${reason}`.trim(),
      },
    });

    this.logger.log(`Lost item ${item.code} marked for disposal: ${reason}`);

    return updated;
  }

  /**
   * Gets statistics for lost and found items within a date range.
   */
  async getStatistics(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const items = await this.prisma.lostAndFound.findMany({
      where,
      select: { status: true, warehouse: true },
    });

    return {
      total: items.length,
      received: items.length,
      claimed: items.filter((i) => i.status === 'CLAIMED').length,
      disposed: items.filter((i) => i.status === 'DISPOSED').length,
      pending: items.filter((i) => i.status === 'UNIDENTIFIED').length,
      byWarehouse: {
        CN: items.filter((i) => i.warehouse === 'CN').length,
        VN: items.filter((i) => i.warehouse === 'VN').length,
      },
    };
  }

  /**
   * Generates lost and found code in the format LNF-YYYYMM-XXXX.
   */
  private async generateCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `LNF-${yearMonth}`;

    const latest = await this.prisma.lostAndFound.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}
