import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { StockMovementType } from '@prisma/client';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { RecordMovementDto } from './dto/record-movement.dto';
import { MovementHistoryQueryDto } from './dto/inventory-query.dto';
import { StocktakeDto } from './dto/stocktake.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers a new stock item (packaging materials, supplies, etc.).
   */
  async createStockItem(dto: CreateStockItemDto) {
    const existing = await this.prisma.stockItem.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Stock item with code ${dto.code} already exists.`);
    }

    const item = await this.prisma.stockItem.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        minLevel: dto.minLevel ?? 0,
        maxLevel: dto.maxLevel ?? 0,
        location: dto.location,
      },
    });

    this.logger.log(`Stock item ${dto.code} created: ${dto.name}`);

    return item;
  }

  /**
   * Records a stock movement (RECEIPT, ISSUE, ADJUSTMENT, TRANSFER).
   * Automatically updates the current quantity on the stock item.
   */
  async recordMovement(dto: RecordMovementDto, userId: string) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id: dto.itemId },
    });

    if (!item) {
      throw new NotFoundException(`Stock item ${dto.itemId} not found.`);
    }

    const qty = Math.abs(dto.quantity);

    // Determine how quantity affects stock
    let delta: number;
    switch (dto.type) {
      case StockMovementType.RECEIPT:
        delta = qty;
        break;
      case StockMovementType.ISSUE:
        if (Number(item.currentQty) < qty) {
          throw new BadRequestException(
            `Insufficient stock. Current: ${item.currentQty}, Requested: ${qty}`,
          );
        }
        delta = -qty;
        break;
      case StockMovementType.ADJUSTMENT:
        // Adjustment can be positive or negative based on original sign
        delta = dto.quantity;
        break;
      case StockMovementType.TRANSFER:
        delta = -qty; // Transfer out from this location
        break;
      default:
        throw new BadRequestException(`Unknown movement type: ${dto.type}`);
    }

    const result = await this.prisma.executeInTransaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          itemId: dto.itemId,
          type: dto.type,
          quantity:
            dto.type === StockMovementType.ISSUE ? -Math.abs(dto.quantity) : Math.abs(dto.quantity),
          reference: dto.reference,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      const updatedItem = await tx.stockItem.update({
        where: { id: dto.itemId },
        data: {
          currentQty: { increment: delta },
        },
      });

      return { movement, item: updatedItem };
    });

    // Emit low stock alert if applicable
    if (
      Number(result.item.currentQty) <= Number(result.item.minLevel) &&
      Number(result.item.minLevel) > 0
    ) {
      this.eventEmitter.emit('inventory.low.stock', {
        itemId: result.item.id,
        code: result.item.code,
        name: result.item.name,
        currentQty: result.item.currentQty,
        minLevel: result.item.minLevel,
      });
    }

    this.logger.log(`Stock movement: ${dto.type} ${dto.quantity} of ${item.code} by ${userId}`);

    return result;
  }

  /**
   * Gets all stock items with current quantities.
   */
  async getCurrentStock() {
    return this.prisma.stockItem.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Gets a single stock item with its movement history.
   */
  async getStockItem(id: string) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found.`);
    }

    return item;
  }

  /**
   * Returns items where current quantity is below minimum level.
   * Uses raw SQL for the column-to-column comparison.
   */
  async getLowStockAlerts() {
    // Prisma does not support column-to-column comparison in where clauses,
    // so we fetch items with a minimum level > 0 and filter in-memory.
    const items = await this.prisma.stockItem.findMany({
      where: {
        minLevel: { gt: 0 },
      },
      orderBy: { currentQty: 'asc' },
    });

    return items.filter((item) => Number(item.currentQty) <= Number(item.minLevel));
  }

  /**
   * Gets movement history for a specific item within a date range.
   */
  async getMovementHistory(itemId: string, query: MovementHistoryQueryDto) {
    const where: any = { itemId };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { code: true, name: true, unit: true } },
      },
    });
  }

  /**
   * Performs physical count reconciliation.
   * Creates ADJUSTMENT movements for any discrepancies.
   */
  async doStocktake(dto: StocktakeDto, userId: string) {
    const results: Array<{
      itemId: string;
      code: string;
      systemQty: number;
      actualQty: number;
      difference: number;
    }> = [];

    await this.prisma.executeInTransaction(async (tx) => {
      for (const entry of dto.items) {
        const item = await tx.stockItem.findUnique({
          where: { id: entry.itemId },
        });

        if (!item) {
          throw new NotFoundException(`Stock item ${entry.itemId} not found.`);
        }

        const difference = entry.actualQty - Number(item.currentQty);

        if (Math.abs(difference) > 0.001) {
          // Create adjustment movement
          await tx.stockMovement.create({
            data: {
              itemId: entry.itemId,
              type: StockMovementType.ADJUSTMENT,
              quantity: difference,
              reference: 'STOCKTAKE',
              notes: `Stocktake adjustment: system=${item.currentQty}, actual=${entry.actualQty}`,
              createdBy: userId,
            },
          });

          // Update current quantity to match physical count
          await tx.stockItem.update({
            where: { id: entry.itemId },
            data: { currentQty: entry.actualQty },
          });
        }

        results.push({
          itemId: entry.itemId,
          code: item.code,
          systemQty: Number(item.currentQty),
          actualQty: entry.actualQty,
          difference,
        });
      }
    });

    const discrepancies = results.filter((r) => Math.abs(r.difference) > 0.001);

    this.logger.log(
      `Stocktake completed by ${userId}: ${results.length} items checked, ${discrepancies.length} adjustments`,
    );

    return { results, totalItems: results.length, adjustments: discrepancies.length };
  }
}
