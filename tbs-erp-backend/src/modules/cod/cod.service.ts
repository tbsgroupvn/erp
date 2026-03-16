import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { CODStatus } from '@prisma/client';
import { calculateBusinessHoursDeadline } from '@common/utils/business-hours';
import { RecordCODCollectionDto } from './dto/record-cod-collection.dto';
import { CodQueryDto } from './dto/cod-query.dto';

@Injectable()
export class CodService {
  private readonly logger = new Logger(CodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Records a COD collection by a driver.
   */
  async recordCODCollection(dto: RecordCODCollectionDto, driverId: string) {
    // Check if a COD record already exists for this delivery
    const existing = await this.prisma.cODRecord.findFirst({
      where: { deliveryId: dto.deliveryId },
    });

    if (existing && existing.status !== CODStatus.PENDING) {
      throw new BadRequestException(
        `COD for delivery ${dto.deliveryId} is already in status ${existing.status}.`,
      );
    }

    if (existing) {
      // Update existing pending record
      const updated = await this.prisma.cODRecord.update({
        where: { id: existing.id },
        data: {
          collectedAmount: dto.amount,
          status: CODStatus.COLLECTED,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
          photoUrl: dto.photoUrl,
          collectedAt: new Date(),
        },
      });

      this.logger.log(
        `COD collection updated for delivery ${dto.deliveryId} by driver ${driverId}`,
      );
      return updated;
    }

    // Create new COD record
    const codRecord = await this.prisma.cODRecord.create({
      data: {
        deliveryId: dto.deliveryId,
        amount: dto.amount,
        collectedAmount: dto.amount,
        status: CODStatus.COLLECTED,
        paymentMethod: dto.paymentMethod,
        driverId,
        notes: dto.notes,
        photoUrl: dto.photoUrl,
        collectedAt: new Date(),
      },
    });

    this.eventEmitter.emit('cod.collected', {
      codId: codRecord.id,
      deliveryId: dto.deliveryId,
      amount: dto.amount,
      driverId,
    });

    this.logger.log(`COD collection recorded for delivery ${dto.deliveryId}: ${dto.amount}`);

    return codRecord;
  }

  /**
   * Gets all COD collections for a driver on a specific date.
   */
  async getDriverCollections(driverId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await this.prisma.cODRecord.findMany({
      where: {
        driverId,
        collectedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { collectedAt: 'asc' },
    });

    const totalCollected = records.reduce((sum, r) => sum + Number(r.collectedAmount), 0);

    return { records, totalCollected, date, driverId };
  }

  /**
   * Confirms that a driver has handed over COD cash to the warehouse.
   */
  async confirmRemittance(driverId: string, date: string, amount: number, userId: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await this.prisma.cODRecord.findMany({
      where: {
        driverId,
        status: CODStatus.COLLECTED,
        collectedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (records.length === 0) {
      throw new NotFoundException(
        `No collected COD records found for driver ${driverId} on ${date}.`,
      );
    }

    const totalCollected = records.reduce((sum, r) => sum + Number(r.collectedAmount), 0);

    if (amount > totalCollected + 0.01) {
      throw new BadRequestException(
        `Remittance amount (${amount}) exceeds collected amount (${totalCollected})`,
      );
    }

    // Update all collected records to REMITTED
    await this.prisma.cODRecord.updateMany({
      where: {
        id: { in: records.map((r) => r.id) },
      },
      data: {
        status: CODStatus.REMITTED,
        remittedAt: new Date(),
      },
    });

    // Check for shortage
    const shortage = totalCollected - amount;
    if (shortage > 0.01) {
      this.logger.warn(
        `COD shortage detected for driver ${driverId} on ${date}: collected=${totalCollected}, remitted=${amount}, shortage=${shortage}`,
      );
      // Flag the shortage but allow the remittance to proceed
    }

    this.eventEmitter.emit('cod.remitted', {
      driverId,
      date,
      totalCollected,
      remittedAmount: amount,
      shortage: Math.max(0, shortage),
      confirmedBy: userId,
    });

    this.logger.log(`COD remittance confirmed for driver ${driverId} on ${date}: ${amount}`);

    return {
      driverId,
      date,
      recordsUpdated: records.length,
      totalCollected,
      remittedAmount: amount,
      shortage: Math.max(0, shortage),
    };
  }

  /**
   * Lists COD records with pagination and filters.
   */
  async findAll(query: CodQueryDto) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.driverId) where.driverId = query.driverId;

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
      this.prisma.cODRecord.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
      }),
      this.prisma.cODRecord.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets reconciliation report comparing collections vs remittances.
   */
  async getReconciliation(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const records = await this.prisma.cODRecord.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    const totalCollected = records
      .filter((r) => r.status !== CODStatus.PENDING)
      .reduce((sum, r) => sum + Number(r.collectedAmount), 0);

    const totalRemitted = records
      .filter((r) => ([CODStatus.REMITTED, CODStatus.RECONCILED] as CODStatus[]).includes(r.status))
      .reduce((sum, r) => sum + Number(r.collectedAmount), 0);

    const totalShortage = records.reduce((sum, r) => sum + Number(r.shortage), 0);

    const byStatus = {
      pending: records.filter((r) => r.status === CODStatus.PENDING).length,
      collected: records.filter((r) => r.status === CODStatus.COLLECTED).length,
      remitted: records.filter((r) => r.status === CODStatus.REMITTED).length,
      reconciled: records.filter((r) => r.status === CODStatus.RECONCILED).length,
      shortage: records.filter((r) => r.status === CODStatus.SHORTAGE).length,
    };

    return {
      dateRange: { startDate, endDate },
      totalRecords: records.length,
      totalCollected,
      totalRemitted,
      totalShortage,
      discrepancy: totalCollected - totalRemitted,
      byStatus,
    };
  }

  /**
   * Flags a COD record for shortage/discrepancy.
   */
  async flagShortage(codId: string, shortageAmount: number, reason: string) {
    const record = await this.prisma.cODRecord.findUnique({
      where: { id: codId },
    });

    if (!record) {
      throw new NotFoundException(`COD record ${codId} not found.`);
    }

    const updated = await this.prisma.cODRecord.update({
      where: { id: codId },
      data: {
        status: CODStatus.SHORTAGE,
        shortage: shortageAmount,
        notes: `${record.notes ?? ''}\nShortage flagged: ${reason}`.trim(),
      },
    });

    this.eventEmitter.emit('cod.shortage.flagged', {
      codId,
      deliveryId: record.deliveryId,
      driverId: record.driverId,
      shortageAmount,
      reason,
    });

    this.logger.warn(`COD shortage flagged: ${codId}, amount=${shortageAmount}, reason=${reason}`);

    return updated;
  }

  /**
   * COD Enforcement Cronjob.
   * Runs daily at 08:00 to enforce COD reconciliation.
   *
   * Finds all COD records with status COLLECTED where collectedAt is more than 24 hours ago
   * (i.e., the driver has not remitted the cash within the SLA).
   * For each such record, blocks the driver from further COD collections
   * by setting isCODBlocked = true on the Driver record.
   */
  @Cron('0 8 * * *')
  async enforceCODReconciliation() {
    this.logger.log('Running COD enforcement reconciliation cronjob...');

    const enforcementHours = this.configService.get<number>('business.cod.enforcementHours', 24);
    const businessHoursConfig = this.configService.get('business.businessHours');

    // Pre-filter: use calendar-based cutoff (business hours deadline is always >= calendar hours)
    const calendarCutoff = new Date();
    calendarCutoff.setHours(calendarCutoff.getHours() - enforcementHours);

    // Find all COLLECTED records older than enforcementHours (not yet remitted)
    const candidateRecords = await this.prisma.cODRecord.findMany({
      where: {
        status: CODStatus.COLLECTED,
        collectedAt: {
          lt: calendarCutoff,
        },
      },
      select: {
        id: true,
        driverId: true,
        deliveryId: true,
        collectedAmount: true,
        collectedAt: true,
      },
    });

    // TX-3: Always use business hours to calculate COD remittance deadline
    const now = new Date();
    const overdueRecords = candidateRecords.filter((record) => {
      if (!record.collectedAt) return true; // No collectedAt means treat as overdue
      const deadline = calculateBusinessHoursDeadline(
        record.collectedAt,
        enforcementHours,
        businessHoursConfig,
      );
      return now >= deadline;
    });

    if (overdueRecords.length === 0) {
      this.logger.log('COD enforcement: No overdue records found.');
      return;
    }

    // Get unique driver IDs from overdue records
    const driverIds = [...new Set(overdueRecords.map((r) => r.driverId).filter((id): id is string => id !== null))];

    this.logger.warn(
      `COD enforcement: Found ${overdueRecords.length} overdue records for ${driverIds.length} driver(s)`,
    );

    // Block each driver
    await this.prisma.driver.updateMany({
      where: {
        id: { in: driverIds },
        isCODBlocked: false, // Only update drivers not already blocked
      },
      data: {
        isCODBlocked: true,
        codBlockedAt: now,
      },
    });

    // Emit enforcement event with blocked driver list
    this.eventEmitter.emit('cod.enforcement.blocked', {
      driverIds,
      overdueRecordCount: overdueRecords.length,
      calendarCutoff,
      enforcedAt: now,
    });

    this.logger.warn(
      `COD enforcement: Blocked ${driverIds.length} driver(s) for overdue COD collections: [${driverIds.join(', ')}]`,
    );
  }
}
