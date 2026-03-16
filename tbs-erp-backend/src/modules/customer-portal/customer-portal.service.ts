import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma } from '@prisma/client';
import { SubmitPreAlertDto } from './dto/submit-pre-alert.dto';
import { UpdateCustomerProfileDto } from './dto/update-profile.dto';
import { CustomerOrderQueryDto } from './dto/portal-query.dto';

/** Cache TTL for customer portal dashboard data (5 minutes in milliseconds). */
const CUSTOMER_PORTAL_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Gets a customer's orders with pagination.
   */
  async getMyOrders(customerId: string, query: CustomerOrderQueryDto) {
    const where: Prisma.OrderWhereInput = { customerId };

    if (query.status) where.status = query.status;
    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          serviceType: true,
          status: true,
          totalAmount: true,
          currency: true,
          depositRequired: true,
          depositPaid: true,
          isDepositPaid: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single order detail for a customer.
   */
  async getOrderDetail(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        items: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            toStatus: true,
            note: true,
            createdAt: true,
          },
        },
        packages: {
          select: {
            id: true,
            code: true,
            actualWeight: true,
            chargeableWeight: true,
            warehouseCNStatus: true,
            warehouseVNStatus: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Gets a customer's wallet balance and recent transactions.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getMyWallet(customerId: string) {
    return this.cacheService.getOrSet(
      `customer-portal:${customerId}:wallet`,
      async () => {
        const wallet = await this.prisma.wallet.findUnique({
          where: { customerId },
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        });

        if (!wallet) {
          // Return zero balance if wallet doesn't exist yet
          return {
            balance: 0,
            currency: 'VND',
            transactions: [],
          };
        }

        return wallet;
      },
      CUSTOMER_PORTAL_CACHE_TTL_MS,
    );
  }

  /**
   * Submits a tracking number pre-alert.
   * Invalidates the customer's dashboard cache after submission.
   */
  async submitPreAlert(customerId: string, dto: SubmitPreAlertDto) {
    const preAlert = await this.prisma.preAlert.create({
      data: {
        customerId,
        trackingNumber: dto.trackingNumber,
        description: dto.description,
        expectedPieces: dto.expectedParcels,
        imageUrl: dto.screenshots ? JSON.stringify(dto.screenshots) : null,
        status: 'WAITING',
      },
    });

    this.logger.log(`Pre-alert submitted by customer ${customerId}: ${dto.trackingNumber}`);

    // Invalidate customer portal caches so fresh data is shown
    await this.cacheService.invalidateByPrefix(`customer-portal:${customerId}:`);

    return preAlert;
  }

  /**
   * Gets a customer's pre-alerts with status and pagination.
   */
  async getMyPreAlerts(customerId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.preAlert.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.preAlert.count({ where: { customerId } }),
    ]);

    return { data, total, page, limit: take };
  }

  /**
   * Gets shipment tracking for a specific package.
   * Results are cached for 5 minutes to reduce database load.
   */
  async getShipmentTracking(customerId: string, packageId: string) {
    return this.cacheService.getOrSet(
      `customer-portal:${customerId}:tracking:${packageId}`,
      async () => {
        // Verify the package belongs to the customer
        const pkg = await this.prisma.package.findFirst({
          where: {
            id: packageId,
            order: { customerId },
          },
          include: {
            order: {
              select: { id: true, code: true, status: true },
            },
          },
        });

        if (!pkg) {
          throw new NotFoundException('Package not found');
        }

        // Get tracking events
        const events = await this.prisma.trackingEvent.findMany({
          where: { packageId },
          orderBy: { eventTimestamp: 'desc' },
          select: {
            eventType: true,
            location: true,
            description: true,
            eventTimestamp: true,
          },
        });

        return {
          package: {
            id: pkg.id,
            code: pkg.code,
            orderId: pkg.order.id,
            orderCode: pkg.order.code,
            orderStatus: pkg.order.status,
          },
          events,
        };
      },
      CUSTOMER_PORTAL_CACHE_TTL_MS,
    );
  }

  /**
   * Gets a customer's invoices with pagination.
   */
  async getMyInvoices(customerId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { customerId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          code: true,
          type: true,
          amount: true,
          taxAmount: true,
          totalAmount: true,
          status: true,
          issuedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit: take };
  }

  /**
   * Gets customer notifications with pagination.
   */
  async getMyNotifications(customerId: string, page = 1, limit = 20) {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    const where = { userId: customerId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit: take };
  }

  /**
   * Updates customer profile/contact info.
   */
  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updateData: Prisma.CustomerUpdateInput = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.companyName !== undefined) updateData.companyName = dto.companyName;

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        code: true,
        fullName: true,
        companyName: true,
        phone: true,
        email: true,
        address: true,
        tier: true,
      },
    });

    // Invalidate customer portal caches after profile update
    await this.cacheService.invalidateByPrefix(`customer-portal:${customerId}:`);

    return updated;
  }

  /**
   * Invalidate all cached data for a specific customer.
   * Call this when external events affect customer data (e.g., order status changes).
   */
  async invalidateCustomerCache(customerId: string): Promise<void> {
    await this.cacheService.invalidateByPrefix(`customer-portal:${customerId}:`);
    this.logger.debug(`Customer portal cache invalidated for customer ${customerId}`);
  }
}
