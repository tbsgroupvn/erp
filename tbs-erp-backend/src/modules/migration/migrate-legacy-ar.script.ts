#!/usr/bin/env ts-node
/**
 * Migration Script: Create AccountReceivable records for legacy unpaid orders
 *
 * This script processes old orders that are in COMPLETED or SETTLEMENT status
 * but don't have proper AR records. It calculates the outstanding amount and
 * creates AR records with appropriate status.
 *
 * Usage:
 *   npm run migrate:legacy-ar                # Production run
 *   npm run migrate:legacy-ar -- --dry-run   # Dry run (preview only)
 *   npm run migrate:legacy-ar -- --rollback  # Rollback last migration
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, OrderStatus, Currency } from '@prisma/client';
import { AppModule } from '../../app.module';

interface MigrationResult {
  success: boolean;
  orderId: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  arCode?: string;
  arAmount?: number;
  arStatus?: string;
  error?: string;
}

interface MigrationReport {
  totalOrdersProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  totalArAmount: number;
  arStatusBreakdown: {
    OPEN: { count: number; amount: number };
    OVERDUE: { count: number; amount: number };
  };
  results: MigrationResult[];
  executedAt: Date;
  isDryRun: boolean;
}

interface RollbackRecord {
  migrationId: string;
  executedAt: Date;
  createdArIds: string[];
  orderIds: string[];
}

class LegacyArMigrationScript {
  private readonly logger = new Logger(LegacyArMigrationScript.name);
  private prisma: PrismaService;
  private readonly MIGRATION_ID_PREFIX = 'LEGACY_AR_MIGRATION';
  private readonly ROLLBACK_FILE = './migration-rollback.json';

  async run(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule);
    this.prisma = app.get(PrismaService);

    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isRollback = args.includes('--rollback');

    try {
      this.logger.log('='.repeat(80));
      this.logger.log('  LEGACY AR MIGRATION SCRIPT');
      this.logger.log('='.repeat(80));

      if (isRollback) {
        await this.rollback();
      } else {
        await this.migrate(isDryRun);
      }
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    } finally {
      await app.close();
    }
  }

  /**
   * Main migration logic
   */
  private async migrate(isDryRun: boolean): Promise<void> {
    this.logger.log(`Mode: ${isDryRun ? 'DRY RUN (Preview Only)' : 'PRODUCTION'}`);
    this.logger.log('-'.repeat(80));

    const startTime = Date.now();
    const report: MigrationReport = {
      totalOrdersProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalArAmount: 0,
      arStatusBreakdown: {
        OPEN: { count: 0, amount: 0 },
        OVERDUE: { count: 0, amount: 0 },
      },
      results: [],
      executedAt: new Date(),
      isDryRun,
    };

    // Step 1: Find all orders with COMPLETED or SETTLEMENT status
    this.logger.log('Step 1: Finding orders with COMPLETED or SETTLEMENT status...');
    const orders = await this.findLegacyOrders();
    this.logger.log(`Found ${orders.length} orders to process`);

    if (orders.length === 0) {
      this.logger.log('No orders to process. Exiting.');
      return;
    }

    // Step 2: Process each order
    this.logger.log('\nStep 2: Processing orders...');
    this.logger.log('-'.repeat(80));

    const createdArIds: string[] = [];
    const processedOrderIds: string[] = [];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      report.totalOrdersProcessed++;

      this.logger.log(`\n[${i + 1}/${orders.length}] Processing Order: ${order.code}`);
      this.logger.log(`  Customer: ${order.customer.fullName} (${order.customer.code})`);
      this.logger.log(`  Total Amount: ${order.totalAmount} ${order.currency}`);
      this.logger.log(`  Deposit Paid: ${order.depositPaid} ${order.currency}`);
      this.logger.log(`  Completed At: ${order.completedAt || 'N/A'}`);

      try {
        // Calculate outstanding amount
        const outstanding = order.totalAmount.toNumber() - order.depositPaid.toNumber();

        if (outstanding <= 0) {
          this.logger.warn(`  ⚠ Outstanding is ${outstanding}. Skipping.`);
          report.results.push({
            success: false,
            orderId: order.id,
            orderCode: order.code,
            customerId: order.customerId,
            customerName: order.customer.fullName,
            error: 'Outstanding amount is zero or negative',
          });
          report.totalFailed++;
          continue;
        }

        // Calculate due date: completedAt + 15 days
        const completedDate = order.completedAt || order.updatedAt;
        const dueDate = new Date(completedDate);
        dueDate.setDate(dueDate.getDate() + 15);

        // Determine status: OPEN or OVERDUE
        const now = new Date();
        const status = dueDate < now ? 'OVERDUE' : 'OPEN';

        this.logger.log(`  Outstanding: ${outstanding} ${order.currency}`);
        this.logger.log(`  Due Date: ${dueDate.toISOString().split('T')[0]}`);
        this.logger.log(`  Status: ${status}`);

        if (isDryRun) {
          this.logger.log(`  ✓ [DRY RUN] Would create AR record`);
          report.results.push({
            success: true,
            orderId: order.id,
            orderCode: order.code,
            customerId: order.customerId,
            customerName: order.customer.fullName,
            arCode: '[DRY-RUN]',
            arAmount: outstanding,
            arStatus: status,
          });
        } else {
          // Create AR record
          const arCode = await this.generateArCode();

          const ar = await this.prisma.accountReceivable.create({
            data: {
              code: arCode,
              customerId: order.customerId,
              orderId: order.id,
              amount: new Prisma.Decimal(outstanding),
              currency: order.currency,
              dueDate,
              status,
              note: 'Migration từ đơn hàng cũ',
              createdBy: 'SYSTEM_MIGRATION',
            },
          });

          createdArIds.push(ar.id);
          processedOrderIds.push(order.id);

          this.logger.log(`  ✓ Created AR: ${arCode} (${ar.id})`);

          report.results.push({
            success: true,
            orderId: order.id,
            orderCode: order.code,
            customerId: order.customerId,
            customerName: order.customer.fullName,
            arCode: ar.code,
            arAmount: outstanding,
            arStatus: status,
          });
        }

        report.totalSuccessful++;
        report.totalArAmount += outstanding;
        report.arStatusBreakdown[status].count++;
        report.arStatusBreakdown[status].amount += outstanding;

      } catch (error) {
        this.logger.error(`  ✗ Failed to process order: ${error.message}`);
        report.results.push({
          success: false,
          orderId: order.id,
          orderCode: order.code,
          customerId: order.customerId,
          customerName: order.customer.fullName,
          error: error.message,
        });
        report.totalFailed++;
      }
    }

    // Step 3: Save rollback information (only in production mode)
    if (!isDryRun && createdArIds.length > 0) {
      await this.saveRollbackInfo({
        migrationId: `${this.MIGRATION_ID_PREFIX}_${Date.now()}`,
        executedAt: new Date(),
        createdArIds,
        orderIds: processedOrderIds,
      });
    }

    // Step 4: Generate report
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    this.printReport(report, duration);
  }

  /**
   * Find all orders that need AR migration
   */
  private async findLegacyOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.COMPLETED, OrderStatus.SETTLEMENT],
        },
        receivables: {
          none: {}, // No AR records exist
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Generate a unique AR code
   */
  private async generateArCode(): Promise<string> {
    const last = await this.prisma.accountReceivable.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(/TBS-AR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-AR-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Save rollback information
   */
  private async saveRollbackInfo(record: RollbackRecord): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const filePath = path.resolve(process.cwd(), this.ROLLBACK_FILE);

    let rollbackData: RollbackRecord[] = [];

    // Read existing rollback data
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      rollbackData = JSON.parse(content);
    }

    // Add new record
    rollbackData.push(record);

    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(rollbackData, null, 2));

    this.logger.log(`\nRollback information saved to: ${filePath}`);
    this.logger.log(`Migration ID: ${record.migrationId}`);
  }

  /**
   * Rollback the last migration
   */
  private async rollback(): Promise<void> {
    this.logger.log('Starting rollback process...');

    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.cwd(), this.ROLLBACK_FILE);

    if (!fs.existsSync(filePath)) {
      this.logger.error('No rollback file found. Nothing to rollback.');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const rollbackData: RollbackRecord[] = JSON.parse(content);

    if (rollbackData.length === 0) {
      this.logger.error('No migration records found in rollback file.');
      return;
    }

    // Get the last migration
    const lastMigration = rollbackData[rollbackData.length - 1];

    this.logger.log(`\nRolling back migration: ${lastMigration.migrationId}`);
    this.logger.log(`Executed at: ${lastMigration.executedAt}`);
    this.logger.log(`AR records to delete: ${lastMigration.createdArIds.length}`);
    this.logger.log('-'.repeat(80));

    try {
      // Delete AR records
      const deleteResult = await this.prisma.accountReceivable.deleteMany({
        where: {
          id: {
            in: lastMigration.createdArIds,
          },
        },
      });

      this.logger.log(`✓ Deleted ${deleteResult.count} AR records`);

      // Remove the last migration from rollback data
      rollbackData.pop();
      fs.writeFileSync(filePath, JSON.stringify(rollbackData, null, 2));

      this.logger.log('✓ Rollback completed successfully');
    } catch (error) {
      this.logger.error(`✗ Rollback failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Print migration report
   */
  private printReport(report: MigrationReport, duration: string): void {
    this.logger.log('\n');
    this.logger.log('='.repeat(80));
    this.logger.log('  MIGRATION REPORT');
    this.logger.log('='.repeat(80));
    this.logger.log(`Mode:                  ${report.isDryRun ? 'DRY RUN' : 'PRODUCTION'}`);
    this.logger.log(`Executed At:           ${report.executedAt.toISOString()}`);
    this.logger.log(`Duration:              ${duration}s`);
    this.logger.log('-'.repeat(80));
    this.logger.log(`Total Orders Processed: ${report.totalOrdersProcessed}`);
    this.logger.log(`Successful:            ${report.totalSuccessful}`);
    this.logger.log(`Failed:                ${report.totalFailed}`);
    this.logger.log('-'.repeat(80));
    this.logger.log(`Total AR Amount Created: ${report.totalArAmount.toFixed(2)} VND`);
    this.logger.log('\nStatus Breakdown:');
    this.logger.log(`  OPEN:     ${report.arStatusBreakdown.OPEN.count} records, ${report.arStatusBreakdown.OPEN.amount.toFixed(2)} VND`);
    this.logger.log(`  OVERDUE:  ${report.arStatusBreakdown.OVERDUE.count} records, ${report.arStatusBreakdown.OVERDUE.amount.toFixed(2)} VND`);
    this.logger.log('='.repeat(80));

    if (report.totalFailed > 0) {
      this.logger.log('\nFailed Orders:');
      this.logger.log('-'.repeat(80));
      const failures = report.results.filter(r => !r.success);
      failures.forEach((result, index) => {
        this.logger.log(`\n${index + 1}. Order: ${result.orderCode}`);
        this.logger.log(`   Customer: ${result.customerName}`);
        this.logger.log(`   Error: ${result.error}`);
      });
    }

    if (report.isDryRun) {
      this.logger.log('\n⚠️  This was a DRY RUN. No changes were made to the database.');
      this.logger.log('   Run without --dry-run flag to execute the migration.');
    } else {
      this.logger.log('\n✓ Migration completed successfully!');
      this.logger.log('   Use --rollback flag to undo this migration if needed.');
    }
  }
}

// Execute script
const script = new LegacyArMigrationScript();
script.run().catch((error) => {
  console.error('Script execution failed:', error);
  process.exit(1);
});
