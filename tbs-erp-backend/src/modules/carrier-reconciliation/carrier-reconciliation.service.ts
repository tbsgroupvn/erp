import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { GeneralLedgerService } from '@modules/general-ledger/general-ledger.service';
import { CarrierReconItemStatus, CarrierReconStatus, CODStatus } from '@prisma/client';
import { generateCode } from '@common/utils/code-generator.util';
import { ExcelParserService } from './domain/excel-parser.service';
import { CarrierMatcherService } from './domain/carrier-matcher.service';
import { UploadCarrierReconDto } from './dto/upload-carrier-recon.dto';
import { ResolveExceptionDto, ResolveAction } from './dto/resolve-exception.dto';
import { CarrierReconQueryDto } from './dto/carrier-recon-query.dto';

@Injectable()
export class CarrierReconciliationService {
  private readonly logger = new Logger(CarrierReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly excelParser: ExcelParserService,
    private readonly carrierMatcher: CarrierMatcherService,
    private readonly walletService: WalletService,
    private readonly glService: GeneralLedgerService,
  ) {}

  /**
   * Upload Excel file, parse, and match against ERP deliveries.
   */
  async uploadAndParse(
    file: Express.Multer.File,
    dto: UploadCarrierReconDto,
    userId: string,
  ) {
    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('File is required');
    }
    if (!file.originalname.match(/\.xlsx?$/i)) {
      throw new BadRequestException('Chi chap nhan file Excel (.xlsx)');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File qua lon (toi da 10MB)');
    }

    // Parse Excel
    const parsedRows = await this.excelParser.parse(
      file.buffer,
      dto.carrierName,
      dto.customMapping,
    );

    if (parsedRows.length === 0) {
      throw new BadRequestException('File Excel khong co du lieu');
    }

    // Generate code
    const code = await generateCode(this.prisma.carrierReconciliation, {
      prefix: 'CRECON',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });

    // Match each row and build items
    const items: any[] = [];
    let matchedCount = 0;
    let exceptionCount = 0;
    let totalCod = 0;
    let totalShipping = 0;
    let totalReturn = 0;
    let totalOther = 0;
    let totalNet = 0;

    for (const row of parsedRows) {
      const matchResult = await this.carrierMatcher.match(
        row.carrierTrackingNumber,
        row.codAmount,
        row.carrierStatus,
      );

      const exceptionStatuses: CarrierReconItemStatus[] = [
        CarrierReconItemStatus.UNMATCHED,
        CarrierReconItemStatus.STATUS_MISMATCH,
        CarrierReconItemStatus.AMOUNT_MISMATCH,
      ];
      const isException = exceptionStatuses.includes(matchResult.matchStatus);

      if (matchResult.matchStatus === CarrierReconItemStatus.MATCHED) {
        matchedCount++;
      }
      if (isException) {
        exceptionCount++;
      }

      totalCod += row.codAmount;
      totalShipping += row.shippingFee;
      totalReturn += row.returnFee;
      totalOther += row.otherFee;
      totalNet += row.netAmount;

      items.push({
        rowNumber: row.rowNumber,
        carrierTrackingNumber: row.carrierTrackingNumber,
        carrierStatus: row.carrierStatus,
        codAmount: row.codAmount,
        shippingFee: row.shippingFee,
        returnFee: row.returnFee,
        otherFee: row.otherFee,
        netAmount: row.netAmount,
        carrierWeight: row.carrierWeight,
        matchedDeliveryId: matchResult.matchedDeliveryId,
        matchedOrderId: matchResult.matchedOrderId,
        matchedOrderCode: matchResult.matchedOrderCode,
        matchedCustomerId: matchResult.matchedCustomerId,
        erpDeliveryStatus: matchResult.erpDeliveryStatus,
        erpCodAmount: matchResult.erpCodAmount,
        codVariance: matchResult.codVariance,
        matchStatus: matchResult.matchStatus,
        exceptionReason: matchResult.exceptionReason,
      });
    }

    // Create reconciliation + items in single transaction
    const recon = await this.prisma.carrierReconciliation.create({
      data: {
        code,
        carrierName: dto.carrierName,
        fileName: file.originalname,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        totalRows: parsedRows.length,
        matchedRows: matchedCount,
        exceptionRows: exceptionCount,
        totalCodAmount: totalCod,
        totalShippingFee: totalShipping,
        totalReturnFee: totalReturn,
        totalOtherFee: totalOther,
        totalNetAmount: totalNet,
        uploadedBy: userId,
        items: {
          create: items,
        },
      },
      include: {
        items: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    this.logger.log(
      `Carrier reconciliation ${code} uploaded: ${parsedRows.length} rows, ` +
        `${matchedCount} matched, ${exceptionCount} exceptions`,
    );

    return recon;
  }

  /**
   * Confirm reconciliation and process matched items.
   */
  async confirm(reconId: string, userId: string) {
    const recon = await this.prisma.carrierReconciliation.findUnique({
      where: { id: reconId },
      include: {
        items: {
          where: {
            matchStatus: {
              in: [CarrierReconItemStatus.MATCHED],
            },
          },
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!recon) {
      throw new NotFoundException(`Phieu doi soat ${reconId} khong ton tai`);
    }

    if (recon.status !== CarrierReconStatus.PENDING) {
      throw new BadRequestException(
        `Phieu doi soat dang o trang thai ${recon.status}, chi confirm duoc khi PENDING`,
      );
    }

    // Update status to CONFIRMED
    await this.prisma.carrierReconciliation.update({
      where: { id: reconId },
      data: {
        status: CarrierReconStatus.CONFIRMED,
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });

    // Process matched items
    let processedCount = 0;
    let totalCodProcessed = 0;
    const errors: string[] = [];

    for (const item of recon.items) {
      if (!item.matchedCustomerId || !item.matchedDeliveryId) continue;

      try {
        const codAmount = Number(item.codAmount);

        if (codAmount > 0) {
          // Credit wallet
          const walletResult = await this.walletService.topup(
            item.matchedCustomerId,
            codAmount,
            `COD-RECON-${recon.code}`,
            `Doi soat COD tu ${recon.carrierName} - ${item.carrierTrackingNumber}`,
          );

          // Emit event for auto-clear AR
          this.eventEmitter.emit('wallet.credited.carrier-cod', {
            customerId: item.matchedCustomerId,
            amount: codAmount,
            newBalance: walletResult.wallet.balance,
            carrierName: recon.carrierName,
            deliveryCode: item.carrierTrackingNumber,
            reconCode: recon.code,
          });

          // Update delivery COD collected
          await this.prisma.delivery.update({
            where: { id: item.matchedDeliveryId },
            data: {
              codCollected: true,
              codCollectedAt: new Date(),
            },
          });

          // Update CODRecord if exists
          await this.prisma.cODRecord.updateMany({
            where: {
              deliveryId: item.matchedDeliveryId,
              status: { in: [CODStatus.PENDING, CODStatus.COLLECTED, CODStatus.REMITTED] },
            },
            data: {
              status: CODStatus.RECONCILED,
            },
          });

          // Mark item as processed
          await this.prisma.carrierReconItem.update({
            where: { id: item.id },
            data: {
              matchStatus: CarrierReconItemStatus.PROCESSED,
              processedAt: new Date(),
              walletTransactionId: walletResult.transaction.id,
            },
          });

          totalCodProcessed += codAmount;
        } else {
          // Zero COD - just mark processed
          await this.prisma.carrierReconItem.update({
            where: { id: item.id },
            data: {
              matchStatus: CarrierReconItemStatus.PROCESSED,
              processedAt: new Date(),
            },
          });
        }

        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process recon item ${item.id} (tracking: ${item.carrierTrackingNumber}): ${error.message}`,
        );
        errors.push(`Row ${item.rowNumber}: ${error.message}`);
      }
    }

    // Create journal entry for carrier fees
    const totalFees =
      Number(recon.totalShippingFee) + Number(recon.totalReturnFee) + Number(recon.totalOtherFee);

    if (totalFees > 0) {
      try {
        await this.glService.createJournalEntry(
          {
            date: new Date().toISOString().split('T')[0],
            description: `Cuoc van chuyen noi dia - ${recon.carrierName} - ${recon.code}`,
            reference: recon.code,
            entries: [
              {
                accountCode: '6427', // Chi phi van chuyen noi dia
                debit: totalFees,
                credit: 0,
                description: `Cuoc ${recon.carrierName}: ship ${Number(recon.totalShippingFee)}, hoan ${Number(recon.totalReturnFee)}, khac ${Number(recon.totalOtherFee)}`,
              },
              {
                accountCode: '1121', // Tien gui ngan hang
                debit: 0,
                credit: totalFees,
                description: `Thanh toan cuoc ${recon.carrierName}`,
              },
            ],
          },
          userId,
        );
      } catch (error) {
        this.logger.error(`Failed to create GL entry for recon ${recon.code}: ${error.message}`);
        errors.push(`Journal entry: ${error.message}`);
      }
    }

    // Update status to COMPLETED
    await this.prisma.carrierReconciliation.update({
      where: { id: reconId },
      data: { status: CarrierReconStatus.COMPLETED },
    });

    // Log to SyncLog for audit
    await this.prisma.syncLog.create({
      data: {
        idempotencyKey: `CARRIER_RECON:CarrierReconciliation:${reconId}:confirm`,
        source: 'CARRIER_RECON',
        entity: 'CarrierReconciliation',
        externalId: reconId,
        action: 'confirm',
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        payload: {
          code: recon.code,
          carrierName: recon.carrierName,
          processedCount,
          totalCodProcessed,
          totalFees,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
    });

    this.eventEmitter.emit('carrier-recon.completed', {
      reconId,
      code: recon.code,
      carrierName: recon.carrierName,
      processedCount,
      totalCodProcessed,
      totalFees,
    });

    this.logger.log(
      `Carrier reconciliation ${recon.code} completed: ${processedCount} items processed, ` +
        `COD ${totalCodProcessed.toLocaleString()} VND, fees ${totalFees.toLocaleString()} VND`,
    );

    return {
      reconId,
      code: recon.code,
      processedCount,
      totalCodProcessed,
      totalFees,
      errors,
    };
  }

  /**
   * Resolve an exception item manually.
   */
  async resolveException(
    reconId: string,
    itemId: string,
    dto: ResolveExceptionDto,
    userId: string,
  ) {
    const item = await this.prisma.carrierReconItem.findFirst({
      where: { id: itemId, reconciliationId: reconId },
      include: {
        reconciliation: { select: { code: true, carrierName: true, status: true } },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item ${itemId} khong ton tai trong phieu doi soat ${reconId}`);
    }

    if (item.matchStatus === CarrierReconItemStatus.PROCESSED) {
      throw new BadRequestException('Item da duoc xu ly');
    }

    if (dto.action === ResolveAction.SKIP) {
      await this.prisma.carrierReconItem.update({
        where: { id: itemId },
        data: {
          matchStatus: CarrierReconItemStatus.SKIPPED,
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolutionNote: dto.resolutionNote,
        },
      });
      return { itemId, action: 'SKIPPED' };
    }

    if (dto.action === ResolveAction.PROCESS && item.matchedCustomerId && item.matchedDeliveryId) {
      const codAmount = Number(item.codAmount);

      if (codAmount > 0) {
        const walletResult = await this.walletService.topup(
          item.matchedCustomerId,
          codAmount,
          `COD-RECON-RESOLVE-${item.reconciliation.code}`,
          `Doi soat COD (resolve) - ${item.carrierTrackingNumber}`,
        );

        this.eventEmitter.emit('wallet.credited.carrier-cod', {
          customerId: item.matchedCustomerId,
          amount: codAmount,
          newBalance: walletResult.wallet.balance,
          carrierName: item.reconciliation.carrierName,
          deliveryCode: item.carrierTrackingNumber,
          reconCode: item.reconciliation.code,
        });

        await this.prisma.delivery.update({
          where: { id: item.matchedDeliveryId },
          data: { codCollected: true, codCollectedAt: new Date() },
        });

        await this.prisma.cODRecord.updateMany({
          where: {
            deliveryId: item.matchedDeliveryId,
            status: { in: [CODStatus.PENDING, CODStatus.COLLECTED, CODStatus.REMITTED] },
          },
          data: { status: CODStatus.RECONCILED },
        });

        await this.prisma.carrierReconItem.update({
          where: { id: itemId },
          data: {
            matchStatus: CarrierReconItemStatus.PROCESSED,
            processedAt: new Date(),
            walletTransactionId: walletResult.transaction.id,
            resolvedBy: userId,
            resolvedAt: new Date(),
            resolutionNote: dto.resolutionNote,
          },
        });

        return { itemId, action: 'PROCESSED', codAmount };
      }
    }

    // Default: RESOLVE (mark resolved without financial processing)
    await this.prisma.carrierReconItem.update({
      where: { id: itemId },
      data: {
        matchStatus: CarrierReconItemStatus.RESOLVED,
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNote: dto.resolutionNote,
      },
    });

    return { itemId, action: 'RESOLVED' };
  }

  /**
   * Cancel a reconciliation.
   */
  async cancel(reconId: string, userId: string) {
    const recon = await this.prisma.carrierReconciliation.findUnique({
      where: { id: reconId },
    });

    if (!recon) {
      throw new NotFoundException(`Phieu doi soat ${reconId} khong ton tai`);
    }

    if (recon.status !== CarrierReconStatus.PENDING) {
      throw new BadRequestException(
        `Chi huy duoc phieu doi soat dang PENDING, hien tai: ${recon.status}`,
      );
    }

    await this.prisma.carrierReconciliation.update({
      where: { id: reconId },
      data: { status: CarrierReconStatus.CANCELLED },
    });

    return { reconId, status: 'CANCELLED' };
  }

  /**
   * List reconciliations with pagination.
   */
  async findAll(query: CarrierReconQueryDto) {
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.carrierName) where.carrierName = query.carrierName;

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
      this.prisma.carrierReconciliation.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
      this.prisma.carrierReconciliation.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Get reconciliation detail with items.
   */
  async findById(id: string) {
    const recon = await this.prisma.carrierReconciliation.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!recon) {
      throw new NotFoundException(`Phieu doi soat ${id} khong ton tai`);
    }

    return recon;
  }

  /**
   * Get only exception items for a reconciliation.
   */
  async getExceptions(reconId: string) {
    const recon = await this.prisma.carrierReconciliation.findUnique({
      where: { id: reconId },
      select: { id: true, code: true },
    });

    if (!recon) {
      throw new NotFoundException(`Phieu doi soat ${reconId} khong ton tai`);
    }

    const items = await this.prisma.carrierReconItem.findMany({
      where: {
        reconciliationId: reconId,
        matchStatus: {
          in: [
            CarrierReconItemStatus.UNMATCHED,
            CarrierReconItemStatus.STATUS_MISMATCH,
            CarrierReconItemStatus.AMOUNT_MISMATCH,
          ],
        },
      },
      orderBy: { rowNumber: 'asc' },
    });

    return { reconId: recon.id, code: recon.code, items };
  }
}
