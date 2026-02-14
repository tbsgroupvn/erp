import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@core/database/prisma.service';
import { AccountsReceivableService } from '@modules/accounts-receivable/accounts-receivable.service';
import { CreateOrderDto } from '../dto/create-order.dto';

/**
 * CreditCheckGuard - Prevents order creation when customer has credit issues
 *
 * Validation Rules:
 * 1. Block if customer has overdue debt > 15 days
 * 2. Block if order amount exceeds available credit (creditLimit - currentDebt)
 *
 * Usage: Apply to order creation endpoints
 * Can be bypassed with @SkipCreditCheck() decorator
 */
@Injectable()
export class CreditCheckGuard implements CanActivate {
  private readonly logger = new Logger(CreditCheckGuard.name);
  private readonly OVERDUE_THRESHOLD_DAYS = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly arService: AccountsReceivableService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if credit check should be skipped
    const skipCreditCheck = this.reflector.get<boolean>(
      'skipCreditCheck',
      context.getHandler(),
    );
    if (skipCreditCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const dto: CreateOrderDto = request.body;

    if (!dto.customerId) {
      // Let the validation pipe handle this
      return true;
    }

    // Fetch customer data
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: {
        id: true,
        code: true,
        fullName: true,
        creditLimit: true,
        currentDebt: true,
        tier: true,
        isActive: true,
        isBlocked: true,
        blockReason: true,
      },
    });

    if (!customer) {
      // Let the service handle customer not found
      return true;
    }

    if (!customer.isActive) {
      throw new ForbiddenException(
        `Không thể tạo đơn hàng. Khách hàng "${customer.fullName}" (${customer.code}) đã bị vô hiệu hóa.`,
      );
    }

    // Check if customer is blocked (by auto-block system)
    if (customer.isBlocked) {
      this.logger.warn(
        `Credit check failed for customer ${customer.code}: Customer is blocked - ${customer.blockReason}`,
      );
      throw new ForbiddenException(
        `Không thể tạo đơn hàng. Khách hàng "${customer.fullName}" (${customer.code}) đã bị chặn. ` +
        `Lý do: ${customer.blockReason}. ` +
        `Vui lòng liên hệ bộ phận tài chính để xử lý công nợ trước khi tạo đơn hàng mới.`,
      );
    }

    // Check for overdue debt
    const overdueDebt = await this.arService.getOverdueDebt(customer.id);

    if (overdueDebt.maxOverdueDays > this.OVERDUE_THRESHOLD_DAYS) {
      this.logger.warn(
        `Credit check failed for customer ${customer.code}: Overdue debt ${overdueDebt.total} VND, max overdue ${overdueDebt.maxOverdueDays} days`,
      );
      throw new ForbiddenException(
        `Không thể tạo đơn hàng. Khách hàng "${customer.fullName}" (${customer.code}) có công nợ quá hạn ${overdueDebt.maxOverdueDays} ngày (vượt quá ${this.OVERDUE_THRESHOLD_DAYS} ngày cho phép). ` +
        `Tổng công nợ quá hạn: ${this.formatCurrency(overdueDebt.total)} VND. ` +
        `Vui lòng thanh toán công nợ trước khi tạo đơn hàng mới.`,
      );
    }

    // Calculate order total amount
    const orderAmount = this.calculateOrderTotal(dto);

    // Check credit limit
    const creditLimit = customer.creditLimit.toNumber();
    const currentDebt = customer.currentDebt.toNumber();
    const availableCredit = creditLimit - currentDebt;

    if (orderAmount > availableCredit) {
      this.logger.warn(
        `Credit check failed for customer ${customer.code}: Order amount ${orderAmount} exceeds available credit ${availableCredit}`,
      );
      throw new ForbiddenException(
        `Không thể tạo đơn hàng. Giá trị đơn hàng ${this.formatCurrency(orderAmount)} VND vượt quá hạn mức tín dụng khả dụng. ` +
        `Hạn mức tín dụng: ${this.formatCurrency(creditLimit)} VND. ` +
        `Công nợ hiện tại: ${this.formatCurrency(currentDebt)} VND. ` +
        `Hạn mức khả dụng: ${this.formatCurrency(availableCredit)} VND. ` +
        `Vui lòng thanh toán công nợ hoặc liên hệ bộ phận tài chính để tăng hạn mức.`,
      );
    }

    // All checks passed
    this.logger.log(
      `Credit check passed for customer ${customer.code}: Order amount ${orderAmount}, available credit ${availableCredit}`,
    );
    return true;
  }

  /**
   * Calculate total order amount from items
   */
  private calculateOrderTotal(dto: CreateOrderDto): number {
    if (!dto.items || dto.items.length === 0) {
      return 0;
    }

    return dto.items.reduce((total, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return total + itemTotal;
    }, 0);
  }

  /**
   * Format currency for Vietnamese display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
