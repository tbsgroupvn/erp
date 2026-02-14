import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ApproverType, UserRole } from '@prisma/client';

export interface ResolvedApprover {
  userId?: string;
  role: UserRole;
}

/**
 * Resolves dynamic approvers based on ApproverType.
 * Handles ROLE, SPECIFIC_USER, DIRECT_MANAGER, DEPARTMENT_HEAD, REQUESTER_MANAGER.
 */
@Injectable()
export class ApproverResolver {
  private readonly logger = new Logger(ApproverResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the approver(s) for a given node configuration.
   */
  async resolve(
    approverType: ApproverType,
    requestedBy: string,
    options?: {
      role?: UserRole;
      userId?: string;
    },
  ): Promise<ResolvedApprover[]> {
    switch (approverType) {
      case ApproverType.SPECIFIC_USER:
        if (!options?.userId || !options?.role) {
          this.logger.warn('SPECIFIC_USER requires userId and role');
          return [];
        }
        return [{ userId: options.userId, role: options.role }];

      case ApproverType.ROLE:
        if (!options?.role) {
          this.logger.warn('ROLE approverType requires a role');
          return [];
        }
        return [{ role: options.role }];

      case ApproverType.DIRECT_MANAGER:
        return this.resolveDirectManager(requestedBy);

      case ApproverType.DEPARTMENT_HEAD:
        return this.resolveDepartmentHead(requestedBy);

      case ApproverType.REQUESTER_MANAGER:
        return this.resolveDirectManager(requestedBy);

      default:
        this.logger.warn(`Unknown approver type: ${approverType}`);
        return [];
    }
  }

  /**
   * Resolve direct manager via User.leaderId.
   */
  private async resolveDirectManager(
    userId: string,
  ): Promise<ResolvedApprover[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { leaderId: true },
    });

    if (!user?.leaderId) {
      this.logger.warn(
        `No direct manager found for user ${userId}, falling back to COO`,
      );
      return [{ role: UserRole.COO }];
    }

    const leader = await this.prisma.user.findUnique({
      where: { id: user.leaderId },
      select: { id: true, role: true },
    });

    if (!leader) {
      return [{ role: UserRole.COO }];
    }

    return [{ userId: leader.id, role: leader.role }];
  }

  /**
   * Resolve department head based on requester's role group.
   */
  private async resolveDepartmentHead(
    userId: string,
  ): Promise<ResolvedApprover[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return [{ role: UserRole.COO }];
    }

    const departmentHead = this.getDepartmentHeadRole(user.role);
    return [{ role: departmentHead }];
  }

  /**
   * Map a user role to its department head role.
   */
  private getDepartmentHeadRole(role: UserRole): UserRole {
    const salesRoles: UserRole[] = [UserRole.SALE, UserRole.SALES_LEADER, UserRole.CSKH];
    if (salesRoles.includes(role)) {
      return UserRole.SALES_DIRECTOR;
    }

    const financeRoles: UserRole[] = [UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST];
    if (financeRoles.includes(role)) {
      return UserRole.CHIEF_ACCOUNTANT;
    }

    const xnkRoles: UserRole[] = [UserRole.XNK_STAFF];
    if (xnkRoles.includes(role)) {
      return UserRole.XNK_MANAGER;
    }

    const warehouseRoles: UserRole[] = [UserRole.WAREHOUSE_VN_STAFF, UserRole.WAREHOUSE_CN_AGENT];
    if (warehouseRoles.includes(role)) {
      return UserRole.WAREHOUSE_VN_MANAGER;
    }

    // Default to COO
    return UserRole.COO;
  }
}
