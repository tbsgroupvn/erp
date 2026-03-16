import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@core/database/prisma.service';

// ─── Named constants (magic number elimination) ──────────────────────────

/** So thang nhin lai khi tinh analytics (lay don hang trong 12 thang gan nhat) */
const ANALYTICS_LOOKBACK_MONTHS = 12;
/** Nguong ratio ngay/interval cho muc MEDIUM churn risk */
const CHURN_MEDIUM_THRESHOLD = 1.0;
/** Nguong ratio ngay/interval cho muc HIGH churn risk */
const CHURN_HIGH_THRESHOLD = 1.5;
/** Nguong ratio ngay/interval cho muc CRITICAL churn risk */
const CHURN_CRITICAL_THRESHOLD = 2.0;
/** So ngay khong dat hang ma khach hang bi danh gia HIGH risk (khi chi co 1 don) */
const NO_ORDER_HIGH_RISK_DAYS = 90;
/** So nam du bao trong tinh CLV (Customer Lifetime Value) */
const CLV_PROJECTION_YEARS = 3;

// ─── Kieu du lieu noi bo ───────────────────────────────────────────────────

export type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CustomerAnalyticsResult {
  customerId: string;
  totalOrders: number;
  avgOrderInterval: number | null;      // So ngay trung binh giua cac don
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  churnRisk: ChurnRisk;
  predictedNextOrder: Date | null;
  clv: Decimal | null;                  // Customer Lifetime Value - du bao 3 nam
  avgOrderValue: Decimal | null;
  preferredServiceType: string | null;
}

// ─── Su kien phat ra khi co khach hang bi canh bao roi bo ─────────────────

export interface ChurnAlertEvent {
  customerId: string;
  customerName: string;
  saleId: string | null;
  churnRisk: ChurnRisk;
  daysSinceLastOrder: number;
  previousChurnRisk: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Cron job chay hang ngay luc 2:00 AM ──────────────────────────────

  /**
   * Tinh toan analytics cho tat ca khach hang active.
   * Chay tu dong moi ngay luc 02:00 AM.
   */
  @Cron('0 2 * * *')
  async calculateAll(): Promise<void> {
    this.logger.log('Bat dau tinh toan analytics cho tat ca khach hang...');
    const startTime = Date.now();

    // Lay tat ca khach hang dang hoat dong
    const customers = await this.prisma.customer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        saleId: true,
        analytics: {
          select: { churnRisk: true },
        },
      },
    });

    this.logger.log(`Tim thay ${customers.length} khach hang can tinh toan`);

    const customerIds = customers.map((c) => c.id);
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - ANALYTICS_LOOKBACK_MONTHS);

    // Batch query: lay TẤT CA don hang cua moi khach hang hoat dong trong 1 query
    const allOrders = await this.prisma.order.findMany({
      where: {
        customerId: { in: customerIds },
        createdAt: { gte: twelveMonthsAgo },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        customerId: true,
        createdAt: true,
        totalAmount: true,
        serviceType: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group orders by customerId trong bo nho
    const ordersByCustomer = new Map<string, typeof allOrders>();
    for (const order of allOrders) {
      const existing = ordersByCustomer.get(order.customerId);
      if (existing) {
        existing.push(order);
      } else {
        ordersByCustomer.set(order.customerId, [order]);
      }
    }

    this.logger.log(
      `Tai ${allOrders.length} don hang cho ${customers.length} khach hang (1 query)`,
    );

    let processed = 0;
    let errors = 0;
    const churnAlerts: ChurnAlertEvent[] = [];
    const upsertOps: Parameters<typeof this.prisma.customerAnalytics.upsert>[0][] = [];

    for (const customer of customers) {
      try {
        const orders = ordersByCustomer.get(customer.id) ?? [];
        const previousRisk = customer.analytics?.churnRisk ?? null;
        const result = this.computeAnalytics(customer.id, orders, now);

        // Gom upsert operation de thuc hien batch
        upsertOps.push({
          where: { customerId: customer.id },
          create: {
            customerId: customer.id,
            totalOrders: result.totalOrders,
            avgOrderInterval: result.avgOrderInterval,
            lastOrderDate: result.lastOrderDate,
            daysSinceLastOrder: result.daysSinceLastOrder,
            churnRisk: result.churnRisk,
            predictedNextOrder: result.predictedNextOrder,
            clv: result.clv,
            avgOrderValue: result.avgOrderValue,
            preferredServiceType: result.preferredServiceType,
            metadata: { calculatedAt: now.toISOString(), ordersAnalyzed: result.totalOrders },
          },
          update: {
            totalOrders: result.totalOrders,
            avgOrderInterval: result.avgOrderInterval,
            lastOrderDate: result.lastOrderDate,
            daysSinceLastOrder: result.daysSinceLastOrder,
            churnRisk: result.churnRisk,
            predictedNextOrder: result.predictedNextOrder,
            clv: result.clv,
            avgOrderValue: result.avgOrderValue,
            preferredServiceType: result.preferredServiceType,
            metadata: { calculatedAt: now.toISOString(), ordersAnalyzed: result.totalOrders },
          },
        });

        // Phat su kien canh bao neu muc rui ro la HIGH hoac CRITICAL
        const isHighRisk = result.churnRisk === 'HIGH' || result.churnRisk === 'CRITICAL';
        if (isHighRisk && result.daysSinceLastOrder !== null) {
          churnAlerts.push({
            customerId: customer.id,
            customerName: customer.companyName ?? customer.fullName,
            saleId: customer.saleId,
            churnRisk: result.churnRisk,
            daysSinceLastOrder: result.daysSinceLastOrder,
            previousChurnRisk: previousRisk,
          });
        }

        processed++;
      } catch (err) {
        errors++;
        this.logger.error(
          `Loi tinh toan analytics cho khach hang ${customer.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    // Batch upsert tat ca analytics trong 1 transaction thay vi N query rieng le
    if (upsertOps.length > 0) {
      await this.prisma.$transaction(
        upsertOps.map((op) => this.prisma.customerAnalytics.upsert(op)),
      );
    }

    // Phat su kien churn.alert.batch cho ChurnAlertListener xu ly
    if (churnAlerts.length > 0) {
      this.eventEmitter.emit('crm.churn.alert.batch', churnAlerts);
      this.logger.warn(
        `Phat hien ${churnAlerts.length} khach hang co nguy co roi bo (HIGH/CRITICAL)`,
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(
      `Hoan thanh tinh toan analytics: ${processed} thanh cong, ${errors} loi, ${elapsed}s`,
    );
  }

  /**
   * Tinh toan analytics tu danh sach don hang co san trong bo nho (khong query DB).
   * Dung noi bo boi calculateAll() de tranh N+1.
   */
  private computeAnalytics(
    customerId: string,
    orders: Array<{ createdAt: Date; totalAmount: any; serviceType: string }>,
    now: Date,
  ): CustomerAnalyticsResult {
    const totalOrders = orders.length;

    // ─── avgOrderInterval ─────────────────────────────────────────────────────
    let avgOrderInterval: number | null = null;
    if (orders.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < orders.length; i++) {
        const diffDays = Math.round(
          (orders[i].createdAt.getTime() - orders[i - 1].createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (diffDays > 0) intervals.push(diffDays);
      }
      if (intervals.length > 0) {
        const rawAvg = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
        avgOrderInterval = Math.max(1, Math.round(rawAvg));
      }
    }

    // ─── daysSinceLastOrder ───────────────────────────────────────────────────
    const lastOrder = orders.length > 0 ? orders[orders.length - 1] : null;
    const lastOrderDate = lastOrder?.createdAt ?? null;
    let daysSinceLastOrder: number | null = null;
    if (lastOrderDate) {
      daysSinceLastOrder = Math.floor(
        (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // ─── churnRisk ────────────────────────────────────────────────────────────
    let churnRisk: ChurnRisk = 'LOW';
    if (avgOrderInterval && avgOrderInterval > 0 && daysSinceLastOrder !== null) {
      const ratio = daysSinceLastOrder / avgOrderInterval;
      if (ratio < CHURN_MEDIUM_THRESHOLD) churnRisk = 'LOW';
      else if (ratio < CHURN_HIGH_THRESHOLD) churnRisk = 'MEDIUM';
      else if (ratio < CHURN_CRITICAL_THRESHOLD) churnRisk = 'HIGH';
      else churnRisk = 'CRITICAL';
    } else if (daysSinceLastOrder !== null && daysSinceLastOrder > NO_ORDER_HIGH_RISK_DAYS) {
      churnRisk = 'HIGH';
    }

    // ─── predictedNextOrder ───────────────────────────────────────────────────
    let predictedNextOrder: Date | null = null;
    if (lastOrderDate && avgOrderInterval) {
      predictedNextOrder = new Date(
        lastOrderDate.getTime() + avgOrderInterval * 24 * 60 * 60 * 1000,
      );
    }

    // ─── avgOrderValue & CLV ──────────────────────────────────────────────────
    let avgOrderValue: Decimal | null = null;
    let clv: Decimal | null = null;
    const ordersWithAmount = orders.filter((o) => o.totalAmount != null);
    if (ordersWithAmount.length > 0) {
      const totalAmount = ordersWithAmount.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);
      const avg = totalAmount / ordersWithAmount.length;
      avgOrderValue = new Decimal(avg.toFixed(2));
      const estimatedOrdersPerYear = avgOrderInterval
        ? Math.round(365 / avgOrderInterval)
        : ordersWithAmount.length;
      clv = new Decimal((avg * estimatedOrdersPerYear * CLV_PROJECTION_YEARS).toFixed(2));
    }

    // ─── preferredServiceType ─────────────────────────────────────────────────
    let preferredServiceType: string | null = null;
    if (orders.length > 0) {
      const counts: Record<string, number> = {};
      for (const o of orders) {
        if (o.serviceType) counts[o.serviceType] = (counts[o.serviceType] ?? 0) + 1;
      }
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (entries.length > 0) preferredServiceType = entries[0][0];
    }

    return {
      customerId,
      totalOrders,
      avgOrderInterval,
      lastOrderDate,
      daysSinceLastOrder,
      churnRisk,
      predictedNextOrder,
      clv,
      avgOrderValue,
      preferredServiceType,
    };
  }

  // ─── Query methods cho controller ────────────────────────────────────

  /**
   * Lay ban ghi analytics cho mot khach hang.
   * Tra ve null neu chua co du lieu.
   */
  async findByCustomer(customerId: string) {
    return this.prisma.customerAnalytics.findUnique({
      where: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            tier: true,
          },
        },
      },
    });
  }

  /**
   * Lay danh sach khach hang co nguy co roi bo HIGH hoac CRITICAL, phan trang.
   * Dung cho endpoint churn-risk dashboard.
   */
  async findHighChurnRisk(
    riskFilter: string[],
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.customerAnalytics.findMany({
        where: { churnRisk: { in: riskFilter } },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              fullName: true,
              companyName: true,
              phone: true,
              saleId: true,
              tier: true,
            },
          },
        },
        orderBy: { daysSinceLastOrder: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customerAnalytics.count({
        where: { churnRisk: { in: riskFilter } },
      }),
    ]);

    return { data, total };
  }

  // ─── Tinh toan cho 1 khach hang cu the ───────────────────────────────

  /**
   * Tinh toan va upsert analytics cho mot khach hang cu the.
   * Co the goi truc tiep tu controller de cap nhat theo yeu cau.
   */
  async calculateForCustomer(customerId: string): Promise<CustomerAnalyticsResult> {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - ANALYTICS_LOOKBACK_MONTHS);

    // Lay don hang trong 12 thang gan nhat, sap xep theo ngay tang dan
    const orders = await this.prisma.order.findMany({
      where: {
        customerId,
        createdAt: { gte: twelveMonthsAgo },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        serviceType: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = this.computeAnalytics(customerId, orders, now);

    // Upsert analytics cho khach hang nay
    await this.prisma.customerAnalytics.upsert({
      where: { customerId },
      create: {
        customerId,
        totalOrders: result.totalOrders,
        avgOrderInterval: result.avgOrderInterval,
        lastOrderDate: result.lastOrderDate,
        daysSinceLastOrder: result.daysSinceLastOrder,
        churnRisk: result.churnRisk,
        predictedNextOrder: result.predictedNextOrder,
        clv: result.clv,
        avgOrderValue: result.avgOrderValue,
        preferredServiceType: result.preferredServiceType,
        metadata: { calculatedAt: now.toISOString(), ordersAnalyzed: result.totalOrders },
      },
      update: {
        totalOrders: result.totalOrders,
        avgOrderInterval: result.avgOrderInterval,
        lastOrderDate: result.lastOrderDate,
        daysSinceLastOrder: result.daysSinceLastOrder,
        churnRisk: result.churnRisk,
        predictedNextOrder: result.predictedNextOrder,
        clv: result.clv,
        avgOrderValue: result.avgOrderValue,
        preferredServiceType: result.preferredServiceType,
        metadata: { calculatedAt: now.toISOString(), ordersAnalyzed: result.totalOrders },
      },
    });

    this.logger.debug(
      `Analytics cap nhat cho khach hang ${customerId}: risk=${result.churnRisk}, days=${result.daysSinceLastOrder}, interval=${result.avgOrderInterval}`,
    );

    return result;
  }
}
