import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { calculateBusinessHoursDeadline } from '@common/utils/business-hours';

@Injectable()
export class CreditOverdraftService {
  private readonly logger = new Logger(CreditOverdraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Request a temporary credit overdraft for a customer.
   * Creates an approval request of type CREDIT_OVERDRAFT and sets
   * tempOverdraftLimit with a 24-hour expiry.
   *
   * Uses SELECT FOR UPDATE to prevent concurrent overdraft requests
   * from racing and overwriting each other's limits.
   */
  async requestTempOverdraft(customerId: string, amount: number, saleLeaderId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      // Lock the customer row to prevent concurrent overdraft requests
      const lockedCustomers = await tx.$queryRaw<Array<{
        id: string;
        code: string;
        fullName: string;
        creditLimit: any;
        currentDebt: any;
        tempOverdraftLimit: any;
      }>>`SELECT id, code, "fullName", "creditLimit", "currentDebt", "tempOverdraftLimit"
         FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;

      if (!lockedCustomers || lockedCustomers.length === 0) {
        throw new NotFoundException('Customer not found');
      }

      const customer = lockedCustomers[0];

      // Reject if there's already an active overdraft
      if (customer.tempOverdraftLimit !== null) {
        throw new ConflictException(
          `Customer ${customer.code} already has an active temporary overdraft of ${customer.tempOverdraftLimit}. ` +
            `Wait for it to expire or be cleared before requesting a new one.`,
        );
      }

      // Create approval request
      const approval = await tx.approval.create({
        data: {
          type: 'CREDIT_OVERDRAFT',
          referenceId: customerId,
          referenceCode: customer.code,
          requestedBy: saleLeaderId,
          requestData: {
            customerId,
            amount,
            customerName: customer.fullName,
            currentCreditLimit: Number(customer.creditLimit),
            currentDebt: Number(customer.currentDebt),
          },
          status: 'PENDING',
        },
      });

      // Set temp overdraft limit with expiry based on business hours (KD-3)
      const OVERDRAFT_BUSINESS_HOURS = this.configService.get<number>(
        'business.overdraft.defaultExpiryHours',
        24,
      );
      const businessHoursConfig = this.configService.get('business.businessHours');
      const tempOverdraftExpiry = calculateBusinessHoursDeadline(
        new Date(),
        OVERDRAFT_BUSINESS_HOURS,
        businessHoursConfig,
      );

      await tx.customer.update({
        where: { id: customerId },
        data: {
          tempOverdraftLimit: new Prisma.Decimal(amount),
          tempOverdraftExpiry,
          tempOverdraftApprovedBy: saleLeaderId,
        },
      });

      this.eventEmitter.emit('approval.created', {
        approvalId: approval.id,
        type: 'CREDIT_OVERDRAFT',
      });
      this.logger.log(
        `Temporary credit overdraft requested for customer ${customer.code}: ${amount} by ${saleLeaderId}, expires at ${tempOverdraftExpiry.toISOString()}`,
      );

      return approval;
    });
  }

  /**
   * Cron job that runs every hour to check for expired temporary overdrafts.
   * If the customer still has debt exceeding their credit limit after the
   * overdraft expires, the customer is blocked and a notification is sent to the CEO.
   */
  @Cron('0 * * * *')
  async checkExpiredOverdrafts(): Promise<void> {
    this.logger.log('Checking for expired temporary overdrafts...');

    const now = new Date();

    const expiredCustomers = await this.prisma.customer.findMany({
      where: {
        tempOverdraftExpiry: { lt: now },
        tempOverdraftLimit: { not: null },
      },
    });

    if (expiredCustomers.length === 0) {
      this.logger.log('No expired overdrafts found');
      return;
    }

    for (const customer of expiredCustomers) {
      try {
        const currentDebt = customer.currentDebt.toNumber();
        const creditLimit = customer.creditLimit.toNumber();

        if (currentDebt > creditLimit) {
          // Customer still has debt exceeding credit limit - block them
          await this.prisma.customer.update({
            where: { id: customer.id },
            data: {
              isBlocked: true,
              blockReason: `Temporary overdraft expired. Debt (${currentDebt}) exceeds credit limit (${creditLimit})`,
              blockedAt: now,
              tempOverdraftLimit: null,
              tempOverdraftExpiry: null,
              tempOverdraftApprovedBy: null,
            },
          });

          // Emit notification to CEO
          this.eventEmitter.emit('notification.send', {
            type: 'ALERT',
            title: 'Overdraft Expired - Customer Blocked',
            body: `Customer ${customer.code} (${customer.fullName}) has been blocked. Temporary overdraft expired with outstanding debt of ${currentDebt} exceeding credit limit of ${creditLimit}.`,
            targetRole: 'CEO',
            referenceId: customer.id,
            isUrgent: true,
          });

          this.logger.warn(
            `Customer ${customer.code} blocked: overdraft expired, debt ${currentDebt} > credit limit ${creditLimit}`,
          );
        } else {
          // Debt is within credit limit - just clear the overdraft fields
          await this.prisma.customer.update({
            where: { id: customer.id },
            data: {
              tempOverdraftLimit: null,
              tempOverdraftExpiry: null,
              tempOverdraftApprovedBy: null,
            },
          });

          this.logger.log(
            `Customer ${customer.code}: overdraft expired but debt (${currentDebt}) is within credit limit (${creditLimit}). Overdraft cleared.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process expired overdraft for customer ${customer.code}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log(`Processed ${expiredCustomers.length} expired overdrafts`);
  }
}
