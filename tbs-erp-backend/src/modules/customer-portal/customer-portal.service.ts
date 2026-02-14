import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { SubmitPreAlertDto } from './dto/submit-pre-alert.dto';
import { UpdateCustomerProfileDto } from './dto/update-profile.dto';
import { CustomerOrderQueryDto } from './dto/portal-query.dto';

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   */
  async getMyWallet(customerId: string) {
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
  }

  /**
   * Submits a tracking number pre-alert.
   */
  async submitPreAlert(customerId: string, dto: SubmitPreAlertDto) {
    const preAlert = await this.prisma.preAlert.create({
      data: {
        customerId,
        trackingNumber: dto.trackingNumber,
        description: dto.description,
        expectedPieces: dto.expectedParcels,
        imageUrl: dto.screenshots?.join(','),
        status: 'WAITING',
      },
    });

    this.logger.log(
      `Pre-alert submitted by customer ${customerId}: ${dto.trackingNumber}`,
    );

    return preAlert;
  }

  /**
   * Gets a customer's pre-alerts with status.
   */
  async getMyPreAlerts(customerId: string) {
    return this.prisma.preAlert.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gets shipment tracking for a specific package.
   */
  async getShipmentTracking(customerId: string, packageId: string) {
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
  }

  /**
   * Gets a customer's invoices.
   */
  async getMyInvoices(customerId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
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
    });
  }

  /**
   * Gets customer notifications.
   */
  async getMyNotifications(customerId: string) {
    // Find user linked to this customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { saleId: true },
    });

    // Return notifications from the system related to this customer
    return this.prisma.notification.findMany({
      where: {
        OR: [
          { userId: customerId },
          // If customer has a linked user account, show those too
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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

    return this.prisma.customer.update({
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
  }
}
