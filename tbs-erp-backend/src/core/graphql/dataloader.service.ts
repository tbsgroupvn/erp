import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import * as DataLoader from 'dataloader';

/**
 * DataLoader factory service for N+1 query prevention in GraphQL resolvers.
 *
 * Each DataLoader instance batches and caches database lookups within a single
 * request, so resolving `customer` on 50 orders results in 1 SQL query instead of 50.
 *
 * IMPORTANT: DataLoader instances must be created per-request (scoped) to avoid
 * leaking data between users. The GraphQL module creates them in the context factory.
 */
@Injectable()
export class DataLoaderService {
  private readonly logger = new Logger(DataLoaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create all DataLoader instances for a single request context.
   */
  createLoaders(): IDataLoaders {
    return {
      customerLoader: this.createCustomerLoader(),
      packagesByOrderLoader: this.createPackagesByOrderLoader(),
      orderLoader: this.createOrderLoader(),
      userLoader: this.createUserLoader(),
    };
  }

  // ─── Customer Loader (by ID) ───

  private createCustomerLoader() {
    return new DataLoader<string, any>(async (customerIds: readonly string[]) => {
      this.logger.debug(`Batching customer load for ${customerIds.length} IDs`);
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: [...customerIds] } },
      });
      const customerMap = new Map(customers.map((c) => [c.id, c]));
      return customerIds.map((id) => customerMap.get(id) ?? null);
    });
  }

  // ─── Packages by Order Loader ───

  private createPackagesByOrderLoader() {
    return new DataLoader<string, any[]>(async (orderIds: readonly string[]) => {
      this.logger.debug(`Batching package load for ${orderIds.length} order IDs`);
      const packages = await this.prisma.package.findMany({
        where: { orderId: { in: [...orderIds] } },
      });
      const packageMap = new Map<string, any[]>();
      for (const pkg of packages) {
        const existing = packageMap.get(pkg.orderId) ?? [];
        existing.push(pkg);
        packageMap.set(pkg.orderId, existing);
      }
      return orderIds.map((id) => packageMap.get(id) ?? []);
    });
  }

  // ─── Order Loader (by ID) ───

  private createOrderLoader() {
    return new DataLoader<string, any>(async (orderIds: readonly string[]) => {
      this.logger.debug(`Batching order load for ${orderIds.length} IDs`);
      const orders = await this.prisma.order.findMany({
        where: { id: { in: [...orderIds] } },
      });
      const orderMap = new Map(orders.map((o) => [o.id, o]));
      return orderIds.map((id) => orderMap.get(id) ?? null);
    });
  }

  // ─── User Loader (by ID) ───

  private createUserLoader() {
    return new DataLoader<string, any>(async (userIds: readonly string[]) => {
      this.logger.debug(`Batching user load for ${userIds.length} IDs`);
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          branch: true,
          isActive: true,
        },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return userIds.map((id) => userMap.get(id) ?? null);
    });
  }
}

/**
 * Interface for the DataLoader instances available in GraphQL context.
 */
export interface IDataLoaders {
  customerLoader: DataLoader<string, any>;
  packagesByOrderLoader: DataLoader<string, any[]>;
  orderLoader: DataLoader<string, any>;
  userLoader: DataLoader<string, any>;
}
