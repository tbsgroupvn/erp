import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatus } from '@prisma/client';

/**
 * CSKH-1: Aggregated Customer Support View Service.
 *
 * Provides a single consolidated view of all customer-related data
 * that a support agent needs: customer profile, active orders,
 * financial balances, recent complaints, interaction notes, and
 * support tickets.
 *
 * Uses Promise.all for parallel database queries to minimize latency.
 */
@Injectable()
export class CustomerSupportViewService {
  private readonly logger = new Logger(CustomerSupportViewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a comprehensive support view for a customer.
   *
   * All sub-queries run in parallel via Promise.all to minimize
   * response time. The aggregated result contains:
   *
   *  - customer: Basic profile and credit info
   *  - activeOrders: Orders not in COMPLETED/CANCELLED status
   *  - arBalance: Outstanding AR summary
   *  - recentComplaints: Last 10 complaints
   *  - recentInteractionNotes: Last 10 interaction notes
   *  - supportTickets: Last 10 support tickets
   */
  async getSupportView(customerId: string) {
    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        code: true,
        fullName: true,
        companyName: true,
        phone: true,
        email: true,
        address: true,
        taxCode: true,
        tier: true,
        creditLimit: true,
        currentDebt: true,
        depositRate: true,
        totalOrders: true,
        totalRevenue: true,
        branch: true,
        saleId: true,
        isActive: true,
        isBlocked: true,
        blockReason: true,
        paymentTermDays: true,
        gracePeriodDays: true,
        createdAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Run all sub-queries in parallel
    const [activeOrders, arBalance, recentComplaints, recentInteractionNotes, supportTickets] =
      await Promise.all([
        // Active orders: anything not COMPLETED or CANCELLED
        this.prisma.order.findMany({
          where: {
            customerId,
            status: {
              notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
            },
          },
          select: {
            id: true,
            code: true,
            serviceType: true,
            status: true,
            shippingRoute: true,
            totalAmount: true,
            currency: true,
            depositRequired: true,
            depositPaid: true,
            isDepositPaid: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),

        // AR balance: sum of outstanding receivables
        this.prisma.accountReceivable.aggregate({
          where: {
            customerId,
            status: { in: ['OPEN', 'PARTIAL'] },
          },
          _sum: { amount: true, paidAmount: true },
          _count: true,
        }),

        // Recent complaints (last 10)
        this.prisma.complaint.findMany({
          where: { customerId },
          select: {
            id: true,
            code: true,
            type: true,
            severity: true,
            status: true,
            description: true,
            orderId: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),

        // Recent interaction notes (last 10)
        this.prisma.customerInteractionNote.findMany({
          where: { customerId },
          select: {
            id: true,
            content: true,
            channel: true,
            createdBy: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),

        // Support tickets (last 10)
        this.prisma.supportTicket.findMany({
          where: { customerId },
          select: {
            id: true,
            code: true,
            category: true,
            subject: true,
            status: true,
            priority: true,
            assignedTo: true,
            firstResponseAt: true,
            resolvedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    // Compute AR summary
    const arTotalAmount = arBalance._sum.amount ? Number(arBalance._sum.amount) : 0;
    const arPaidAmount = arBalance._sum.paidAmount ? Number(arBalance._sum.paidAmount) : 0;
    const arOutstanding = arTotalAmount - arPaidAmount;

    this.logger.debug(
      `Support view loaded for customer ${customer.code}: ${activeOrders.length} active orders, ${arBalance._count} AR records`,
    );

    return {
      customer,
      activeOrders: {
        data: activeOrders,
        count: activeOrders.length,
      },
      arBalance: {
        totalAmount: arTotalAmount,
        paidAmount: arPaidAmount,
        outstanding: arOutstanding,
        openCount: arBalance._count,
      },
      recentComplaints: {
        data: recentComplaints,
        count: recentComplaints.length,
      },
      recentInteractionNotes: {
        data: recentInteractionNotes,
        count: recentInteractionNotes.length,
      },
      supportTickets: {
        data: supportTickets,
        count: supportTickets.length,
      },
    };
  }
}
