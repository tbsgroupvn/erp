import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Approval, ApprovalStatus, Prisma, UserRole } from '@prisma/client';
import { ApprovalQueryDto } from './dto/approval-query.dto';

export type ApprovalWithSteps = Approval & {
  steps: Array<{
    id: string;
    approvalId: string;
    stepNumber: number;
    approverRole: UserRole;
    approverId: string | null;
    status: ApprovalStatus;
    comment: string | null;
    decidedAt: Date | null;
    nodeId: string | null;
    assignedUserId: string | null;
    approvalMode: string | null;
    groupKey: string | null;
    delegatedFromUserId: string | null;
    deadlineAt: Date | null;
    isOverdue: boolean;
  }>;
};

const approvalInclude = {
  steps: { orderBy: { stepNumber: 'asc' as const } },
  ccUsers: true,
  comments: { orderBy: { createdAt: 'asc' as const } },
  actionLogs: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class ApprovalRepository {
  private readonly logger = new Logger(ApprovalRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApprovalWithSteps | null> {
    return this.prisma.approval.findUnique({
      where: { id },
      include: approvalInclude,
    }) as Promise<ApprovalWithSteps | null>;
  }

  async findMany(query: ApprovalQueryDto): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.requestedBy) {
      where.requestedBy = query.requestedBy;
    }

    if (query.search) {
      where.referenceCode = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: approvalInclude,
        orderBy: query.orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { data: data as ApprovalWithSteps[], total };
  }

  /**
   * Find pending approvals where the current step requires a specific role.
   */
  async findPendingByRole(
    role: UserRole,
    limit = 20,
    offset = 0,
  ): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    // Fetch all pending approvals with matching role steps,
    // then filter in JS for currentStep accuracy.
    // We fetch without pagination first to get accurate total/filtering,
    // then apply offset/limit on the filtered results.
    const approvals = await this.prisma.approval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        steps: {
          some: {
            approverRole: role,
            status: ApprovalStatus.PENDING,
          },
        },
      },
      include: approvalInclude,
      orderBy: { createdAt: 'desc' },
    });

    const filtered = (approvals as ApprovalWithSteps[]).filter((a) => {
      const currentStep = a.steps.find((s) => s.stepNumber === a.currentStep);
      return currentStep?.approverRole === role && currentStep?.status === ApprovalStatus.PENDING;
    });

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);

    return { data, total };
  }

  /**
   * Find approvals submitted by a specific user.
   */
  async findSubmittedByUser(
    userId: string,
    query: ApprovalQueryDto,
  ): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      requestedBy: userId,
    };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: approvalInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { data: data as ApprovalWithSteps[], total };
  }

  /**
   * Find approvals where a user has made a decision.
   */
  async findProcessedByUser(
    userId: string,
    query: ApprovalQueryDto,
  ): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      steps: { some: { approverId: userId } },
    };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: approvalInclude,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { data: data as ApprovalWithSteps[], total };
  }

  /**
   * Find approvals where a user is CC'd.
   */
  async findCCByUser(
    userId: string,
    query: ApprovalQueryDto,
  ): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      ccUsers: { some: { userId } },
    };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: approvalInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { data: data as ApprovalWithSteps[], total };
  }

  /**
   * Count pending approvals for a user (by role + assigned).
   */
  async countPendingForUser(userId: string, role: UserRole): Promise<number> {
    return this.prisma.approval.count({
      where: {
        status: ApprovalStatus.PENDING,
        steps: {
          some: {
            status: ApprovalStatus.PENDING,
            OR: [{ approverRole: role }, { assignedUserId: userId }],
          },
        },
      },
    });
  }

  /**
   * Count submitted pending approvals for a user.
   */
  async countMySubmitted(userId: string): Promise<number> {
    return this.prisma.approval.count({
      where: {
        requestedBy: userId,
        status: ApprovalStatus.PENDING,
      },
    });
  }

  /**
   * Count approvals processed by a user.
   */
  async countMyProcessed(userId: string): Promise<number> {
    return this.prisma.approval.count({
      where: {
        steps: { some: { approverId: userId } },
      },
    });
  }

  /**
   * Count CC approvals for a user.
   */
  async countMyCCApprovals(userId: string): Promise<number> {
    return this.prisma.approval.count({
      where: {
        ccUsers: { some: { userId } },
      },
    });
  }

  /**
   * Find completed/history approvals for a specific user.
   */
  async findHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: ApprovalWithSteps[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {
      OR: [{ requestedBy: userId }, { steps: { some: { approverId: userId } } }],
      status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
    };

    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: approvalInclude,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { data: data as ApprovalWithSteps[], total };
  }
}
