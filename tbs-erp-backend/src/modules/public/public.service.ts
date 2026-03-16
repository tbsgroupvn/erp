import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CrmRepository } from '@modules/crm/crm.repository';
import { CustomerTierService } from '@modules/crm/domain/customer-tier.service';
import { WalletService } from '@modules/crm/domain/wallet.service';
import { CaptureLeadDto } from './dto/capture-lead.dto';
import { Customer, CustomerTier, Contact, OrderStatus } from '@prisma/client';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmRepository: CrmRepository,
    private readonly customerTierService: CustomerTierService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Capture a lead from the public website/form.
   * - Check if phone exists in Customer table
   * - If exists: Add a new Contact to existing Customer
   * - If not exists: Create new Customer with tier=NEW and add Contact
   * - Emit 'lead.captured' event for notifications
   */
  async captureLead(
    dto: CaptureLeadDto,
  ): Promise<{ customer: Customer; contact: Contact; isNewCustomer: boolean }> {
    this.logger.log(`Capturing lead: ${dto.fullName} - ${dto.phone}`);

    // Normalize phone number (remove spaces, +84 to 0, etc.)
    const normalizedPhone = this.normalizePhone(dto.phone);

    // Check if customer with this phone already exists
    const existingCustomer = await this.findCustomerByPhone(normalizedPhone);

    if (existingCustomer) {
      // Customer exists - add new contact
      this.logger.log(`Customer exists (${existingCustomer.code}), adding new contact`);

      const contact = await this.prisma.contact.create({
        data: {
          customerId: existingCustomer.id,
          fullName: dto.fullName,
          phone: normalizedPhone,
          email: dto.email,
          position: `Lead - ${dto.service}`,
          isPrimary: false,
        },
      });

      // Emit event for existing customer lead
      this.eventEmitter.emit('lead.captured', {
        customer: existingCustomer,
        contact,
        isNewCustomer: false,
        service: dto.service,
        message: dto.message,
      });

      this.logger.log(`Lead captured for existing customer: ${existingCustomer.code}`);

      return {
        customer: existingCustomer,
        contact,
        isNewCustomer: false,
      };
    } else {
      // Customer does not exist - create new customer with tier=NEW
      this.logger.log('New customer detected, creating customer record');

      const code = await this.crmRepository.generateCode();

      const customer = await this.prisma.customer.create({
        data: {
          code,
          fullName: dto.fullName,
          phone: normalizedPhone,
          email: dto.email,
          tier: CustomerTier.NEW,
          depositRate: this.customerTierService.getDepositRate(CustomerTier.NEW),
          creditLimit: this.customerTierService.getCreditLimit(CustomerTier.NEW),
          note: dto.message
            ? `Lead from website - Service: ${dto.service}\nMessage: ${dto.message}`
            : `Lead from website - Service: ${dto.service}`,
        },
        include: {
          contacts: true,
          wallet: true,
        },
      });

      // Create primary contact
      const contact = await this.prisma.contact.create({
        data: {
          customerId: customer.id,
          fullName: dto.fullName,
          phone: normalizedPhone,
          email: dto.email,
          position: `Lead - ${dto.service}`,
          isPrimary: true,
        },
      });

      // Create wallet for the customer
      await this.walletService.getOrCreateWallet(customer.id);

      // Emit event for new customer lead
      this.eventEmitter.emit('lead.captured', {
        customer,
        contact,
        isNewCustomer: true,
        service: dto.service,
        message: dto.message,
      });

      this.logger.log(`New customer created: ${customer.code} - ${customer.fullName}`);

      return {
        customer,
        contact,
        isNewCustomer: true,
      };
    }
  }

  /**
   * Find customer by phone number.
   * Searches for exact match on phone field.
   */
  private async findCustomerByPhone(phone: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: {
        phone,
        isActive: true,
      },
      include: {
        contacts: true,
        wallet: true,
      },
    });
  }

  /**
   * Normalize phone number to consistent format.
   * - Remove spaces and dashes
   * - Convert +84 to 0
   * - Trim whitespace
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.trim().replace(/[\s-]/g, '');

    // Convert +84 to 0
    if (normalized.startsWith('+84')) {
      normalized = '0' + normalized.substring(3);
    }

    return normalized;
  }

  /**
   * Track order or container by code (public endpoint)
   * Returns non-sensitive tracking information
   */
  async trackByCode(code: string) {
    this.logger.log(`Public tracking request for code: ${code}`);

    // Try to find by order code first
    const order = await this.prisma.order.findUnique({
      where: { code },
      include: {
        packages: {
          select: {
            id: true,
            trackingNumberCN: true,
            warehouseCNStatus: true,
            warehouseVNStatus: true,
          },
        },
        statusHistory: {
          select: {
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        container: {
          select: {
            code: true,
            status: true,
            origin: true,
            destination: true,
            estimatedArrivalAt: true,
          },
        },
      },
    });

    if (order) {
      // Get tracking events from packages
      const trackingEvents = await this.prisma.trackingEvent.findMany({
        where: {
          packageId: {
            in: order.packages.map((p) => p.id),
          },
        },
        select: {
          eventType: true,
          location: true,
          description: true,
          eventTimestamp: true,
        },
        orderBy: {
          eventTimestamp: 'desc',
        },
        take: 20,
      });

      return {
        type: 'order',
        code: order.code,
        status: order.status,
        serviceType: order.serviceType,
        shippingRoute: order.shippingRoute,
        currentLocation: this.getCurrentLocation(order.status),
        estimatedDelivery: order.container?.estimatedArrivalAt || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        statusHistory: order.statusHistory.map((h) => ({
          status: h.toStatus,
          note: h.note,
          timestamp: h.createdAt,
        })),
        trackingEvents: trackingEvents.map((e) => ({
          type: e.eventType,
          location: e.location,
          description: e.description,
          timestamp: e.eventTimestamp,
        })),
        container: order.container
          ? {
              code: order.container.code,
              status: order.container.status,
              currentLocation: order.container.origin,
              estimatedArrival: order.container.estimatedArrivalAt,
            }
          : null,
      };
    }

    // Try to find by container code
    const container = await this.prisma.container.findUnique({
      where: { code },
      select: {
        code: true,
        status: true,
        origin: true,
        destination: true,
        estimatedArrivalAt: true,
        actualArrivalAt: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: {
            code: true,
            status: true,
          },
        },
      },
    });

    if (container) {
      // Get tracking events for container
      const trackingEvents = await this.prisma.trackingEvent.findMany({
        where: {
          containerId: container.code,
        },
        select: {
          eventType: true,
          location: true,
          description: true,
          eventTimestamp: true,
        },
        orderBy: {
          eventTimestamp: 'desc',
        },
        take: 20,
      });

      return {
        type: 'container',
        code: container.code,
        status: container.status,
        currentLocation: container.origin || container.destination || 'Đang vận chuyển',
        estimatedDelivery: container.estimatedArrivalAt,
        actualDelivery: container.actualArrivalAt,
        createdAt: container.createdAt,
        updatedAt: container.updatedAt,
        trackingEvents: trackingEvents.map((e) => ({
          type: e.eventType,
          location: e.location,
          description: e.description,
          timestamp: e.eventTimestamp,
        })),
        orders: container.orders.map((o) => ({
          code: o.code,
          status: o.status,
        })),
      };
    }

    // Not found
    return null;
  }

  /**
   * Get active service fee configs for the public pricing page.
   * Returns only public-safe fields (no internal IDs, createdBy, etc.)
   */
  async getPublicServiceFees() {
    const configs = await this.prisma.serviceFeeConfig.findMany({
      where: { isActive: true },
      orderBy: [{ serviceType: 'asc' }, { priority: 'desc' }],
      select: {
        serviceType: true,
        name: true,
        customerTier: true,
        feePercent: true,
        minFeeAmount: true,
        maxFeeAmount: true,
        minOrderValue: true,
        maxOrderValue: true,
        minQuantity: true,
        productCategory: true,
        priority: true,
        note: true,
      },
    });

    return configs;
  }

  /**
   * Get aggregate stats for the public website "success metrics" section.
   * Returns total active customers, total completed orders, and years of operation.
   */
  async getPublicStats(): Promise<{
    totalCustomers: number;
    totalCompletedOrders: number;
    yearsOfOperation: number;
  }> {
    const [totalCustomers, totalCompletedOrders] = await Promise.all([
      this.prisma.customer.count({
        where: { isActive: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.COMPLETED },
      }),
    ]);

    // TBS was founded in 2014
    const foundingYear = 2014;
    const yearsOfOperation = new Date().getFullYear() - foundingYear;

    return {
      totalCustomers,
      totalCompletedOrders,
      yearsOfOperation,
    };
  }

  /**
   * Get human-readable current location based on order status
   */
  private getCurrentLocation(status: OrderStatus): string {
    const locationMap: Record<OrderStatus, string> = {
      CONSULTING: 'Đang tư vấn',
      QUOTATION: 'Đang báo giá',
      PENDING_DEPOSIT: 'Chờ đặt cọc',
      SOURCING: 'Đang mua hàng tại Trung Quốc',
      WAREHOUSE_CN: 'Kho Trung Quốc',
      PACKING: 'Đang đóng gói',
      CONSOLIDATION: 'Đang ghép container',
      IN_TRANSIT: 'Đang vận chuyển',
      CUSTOMS: 'Đang thông quan',
      WAREHOUSE_VN: 'Kho Việt Nam',
      DELIVERING: 'Đang giao hàng',
      SETTLEMENT: 'Đang quyết toán',
      COMPLETED: 'Đã hoàn thành',
      ON_HOLD: 'Tạm giữ',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Đã trả hàng',
      ISSUE: 'Có vấn đề',
    };

    return locationMap[status] || 'Không xác định';
  }
}
