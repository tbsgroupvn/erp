import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ICurrentUser } from '../interfaces/current-user.interface';

/**
 * Data scope filter that determines what records a user can access
 * based on their role in the organizational hierarchy.
 */
export interface DataScopeFilter {
  /** If set, restrict data to a specific branch */
  branch?: string;
  /** If set, restrict data to a specific sale user ID */
  saleId?: string;
  /** If set, restrict data to records belonging to the user's team */
  teamLeaderId?: string;
  /** If set, restrict data to a specific driver user ID */
  driverId?: string;
  /** If true, the user has unrestricted access across all data */
  isGlobal: boolean;
  /** If true, the user is denied all data access */
  denied?: boolean;
}

@Injectable()
export class DataScopeGuard implements CanActivate {
  private readonly logger = new Logger(DataScopeGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;

    if (!user) {
      return true; // Let auth guard handle missing user
    }

    const scopeFilter = this.buildDataScopeFilter(user);
    request.dataScope = scopeFilter;

    return true;
  }

  private buildDataScopeFilter(user: ICurrentUser): DataScopeFilter {
    switch (user.role) {
      // Top-level management: see everything
      case UserRole.CEO:
      case UserRole.COO:
        return { isGlobal: true };

      // Directors: see all orders/customers (no restriction)
      case UserRole.SALES_DIRECTOR:
        return { isGlobal: true };

      // Leaders: see own team data
      case UserRole.SALES_LEADER:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
          teamLeaderId: user.id,
        };

      // Individual sales: see only their own records
      case UserRole.SALE:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
          saleId: user.id,
        };

      // Accounting roles: see all financial data (cross-branch)
      case UserRole.CHIEF_ACCOUNTANT:
        return { isGlobal: true };
      case UserRole.ACCOUNTANT_AR:
      case UserRole.ACCOUNTANT_COST:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
        };

      // XNK: see all logistics data
      case UserRole.XNK_MANAGER:
        return { isGlobal: true };
      case UserRole.XNK_STAFF:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
        };

      // Warehouse: scoped to their warehouse
      case UserRole.WAREHOUSE_CN_AGENT:
      case UserRole.WAREHOUSE_VN_MANAGER:
      case UserRole.WAREHOUSE_VN_STAFF:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
        };

      // Marketing, CSKH: see customer data in their branch
      case UserRole.MARKETING_STAFF:
      case UserRole.CSKH:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
        };

      // Driver: see assigned deliveries only
      case UserRole.DRIVER:
        return {
          isGlobal: false,
          branch: user.branch ?? undefined,
          driverId: user.id,
        };

      default:
        this.logger.warn(`Unknown role ${user.role} - denying data access`);
        return { isGlobal: false, denied: true };
    }
  }
}
