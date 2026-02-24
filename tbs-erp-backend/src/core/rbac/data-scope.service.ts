import { Injectable, Logger } from '@nestjs/common';
import { UserRole, Branch } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { isExecutive } from './roles.enum';

/** Cache TTL for data scope filters (10 minutes in milliseconds). */
const DATA_SCOPE_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Represents the authenticated user context needed for data scoping.
 */
export interface DataScopeUser {
  userId: string;
  role: UserRole;
  branch?: Branch | null;
}

/**
 * A Prisma-compatible WHERE clause for data isolation.
 * Returns an object that can be spread into a Prisma `where` argument.
 */
export type DataScopeFilter = Record<string, any>;

@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Returns a Prisma WHERE clause that restricts data access based on
   * the user's role and organizational position.
   *
   * For order-centric entities (Orders, Customers):
   *   - SALE: only records they own ({ saleId: userId } or { createdBy: userId })
   *   - SALES_LEADER: records owned by their team members
   *   - SALES_DIRECTOR, CEO, COO: all records (no filter)
   *   - Other roles: scoped by branch when applicable
   *
   * @param user The authenticated user context
   * @param entityType Optional hint about the entity type being filtered
   */
  async getDataScopeFilter(
    user: DataScopeUser,
    entityType?: 'order' | 'customer' | 'finance' | 'warehouse' | 'delivery',
  ): Promise<DataScopeFilter> {
    // Executives see everything
    if (isExecutive(user.role)) {
      return {};
    }

    switch (user.role) {
      // -----------------------------------------------------------------
      // Sales hierarchy
      // -----------------------------------------------------------------
      case UserRole.SALE:
        return this.buildSaleFilter(user.userId, entityType);

      case UserRole.SALES_LEADER:
        return this.buildSalesLeaderFilter(user.userId, entityType);

      case UserRole.SALES_DIRECTOR:
        // Sales director sees all orders/customers (no restriction)
        return {};

      // -----------------------------------------------------------------
      // Finance roles: scoped by branch
      // -----------------------------------------------------------------
      case UserRole.CHIEF_ACCOUNTANT:
        // Chief accountant sees all finance across branches
        return {};

      case UserRole.ACCOUNTANT_AR:
      case UserRole.ACCOUNTANT_COST:
        return this.buildBranchFilter(user.branch, entityType);

      // -----------------------------------------------------------------
      // XNK roles
      // -----------------------------------------------------------------
      case UserRole.XNK_MANAGER:
        // XNK manager sees all containers/customs
        return {};

      case UserRole.XNK_STAFF:
        return this.buildBranchFilter(user.branch, entityType);

      // -----------------------------------------------------------------
      // Warehouse roles: scoped by warehouse location
      // -----------------------------------------------------------------
      case UserRole.WAREHOUSE_CN_AGENT:
        // CN agent sees packages in CN warehouse
        if (entityType === 'warehouse') {
          return { warehouseCNStatus: { not: null } };
        }
        return {};

      case UserRole.WAREHOUSE_VN_MANAGER:
        // VN manager sees all VN warehouse data
        if (entityType === 'warehouse') {
          return { warehouseVNStatus: { not: null } };
        }
        return this.buildBranchFilter(user.branch, entityType);

      case UserRole.WAREHOUSE_VN_STAFF:
        if (entityType === 'warehouse') {
          return { warehouseVNStatus: { not: null } };
        }
        return this.buildBranchFilter(user.branch, entityType);

      // -----------------------------------------------------------------
      // Driver: sees only assigned deliveries
      // -----------------------------------------------------------------
      case UserRole.DRIVER:
        if (entityType === 'delivery') {
          return { driverId: user.userId };
        }
        return this.buildBranchFilter(user.branch, entityType);

      // -----------------------------------------------------------------
      // Marketing / CSKH
      // -----------------------------------------------------------------
      case UserRole.MARKETING_STAFF:
      case UserRole.CSKH:
        return this.buildBranchFilter(user.branch, entityType);

      default:
        this.logger.warn(
          `No data scope rule defined for role ${user.role}, defaulting to own-only`,
        );
        return { createdBy: user.userId };
    }
  }

  /**
   * Get the list of team member IDs for a sales leader.
   * Used to scope data to the leader's team.
   * Results are cached for 10 minutes since team composition rarely changes.
   */
  async getTeamMemberIds(leaderId: string): Promise<string[]> {
    return this.cacheService.getOrSet(
      `data-scope:${leaderId}:team-members`,
      async () => {
        const teamMembers = await this.prisma.user.findMany({
          where: { leaderId },
          select: { id: true },
        });

        // Include the leader themselves
        return [leaderId, ...teamMembers.map((m) => m.id)];
      },
      DATA_SCOPE_CACHE_TTL_MS,
    );
  }

  /**
   * Invalidate cached data scope for a specific user.
   * Call this when a user's role or team assignment changes.
   */
  async invalidateUserScope(userId: string): Promise<void> {
    await this.cacheService.invalidateByPrefix(`data-scope:${userId}:`);
    this.logger.debug(`Data scope cache invalidated for user ${userId}`);
  }

  /**
   * Invalidate all data scope caches.
   * Call this during bulk role/team reassignments.
   */
  async invalidateAllScopes(): Promise<void> {
    await this.cacheService.invalidateByPrefix('data-scope:');
    this.logger.debug('All data scope caches invalidated');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build filter for a SALE role: only own records.
   */
  private buildSaleFilter(
    userId: string,
    entityType?: string,
  ): DataScopeFilter {
    switch (entityType) {
      case 'order':
        return { saleId: userId };
      case 'customer':
        // Customers created by or assigned to this sale
        return {
          OR: [{ createdBy: userId }, { saleId: userId }],
        };
      case 'finance':
        return { createdBy: userId };
      default:
        // Fallback: match either saleId or createdBy
        return {
          OR: [{ saleId: userId }, { createdBy: userId }],
        };
    }
  }

  /**
   * Build filter for a SALES_LEADER role: records belonging to their team.
   */
  private async buildSalesLeaderFilter(
    leaderId: string,
    entityType?: string,
  ): Promise<DataScopeFilter> {
    const teamMemberIds = await this.getTeamMemberIds(leaderId);

    switch (entityType) {
      case 'order':
        return { saleId: { in: teamMemberIds } };
      case 'customer':
        return {
          OR: [
            { createdBy: { in: teamMemberIds } },
            { saleId: { in: teamMemberIds } },
          ],
        };
      case 'finance':
        return { createdBy: { in: teamMemberIds } };
      default:
        return {
          OR: [
            { saleId: { in: teamMemberIds } },
            { createdBy: { in: teamMemberIds } },
          ],
        };
    }
  }

  /**
   * Build filter for branch-scoped roles.
   * If the user has no branch assigned, returns a filter that matches nothing
   * to prevent privilege escalation (seeing all data).
   */
  private buildBranchFilter(
    branch?: Branch | null,
    entityType?: string,
  ): DataScopeFilter {
    if (!branch) {
      // If branch is required but not set, match nothing for safety
      return { branch: 'NO_BRANCH_ASSIGNED' as Branch };
    }

    // For entities that have a direct branch field
    if (entityType === 'order' || entityType === 'delivery') {
      return { branch };
    }

    // For finance entities, scope by related order's branch or fallback
    if (entityType === 'finance') {
      return {
        order: { branch },
      };
    }

    // Default: try the branch field
    return { branch };
  }
}
