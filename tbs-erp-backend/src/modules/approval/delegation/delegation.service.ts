import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      isActive: true,
    };
    const [data, total] = await Promise.all([
      this.prisma.approvalDelegation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.approvalDelegation.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async create(dto: CreateDelegationDto, userId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (dto.toUserId === userId) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    if (endDate <= new Date()) {
      throw new BadRequestException('endDate must be in the future');
    }

    return this.prisma.approvalDelegation.create({
      data: {
        fromUserId: userId,
        toUserId: dto.toUserId,
        approvalTypes: dto.approvalTypes ?? [],
        startDate,
        endDate,
        reason: dto.reason,
        isActive: true,
      },
    });
  }

  async deactivate(id: string, userId: string) {
    const delegation = await this.prisma.approvalDelegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      throw new NotFoundException(`Delegation ${id} not found`);
    }

    if (delegation.fromUserId !== userId) {
      throw new ForbiddenException('Only the delegator can deactivate a delegation');
    }

    return this.prisma.approvalDelegation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Find active delegation for a user and approval type.
   */
  async findActiveDelegation(userId: string, approvalType?: string) {
    const now = new Date();
    return this.prisma.approvalDelegation.findFirst({
      where: {
        fromUserId: userId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        ...(approvalType
          ? {
              OR: [{ approvalTypes: { isEmpty: true } }, { approvalTypes: { has: approvalType } }],
            }
          : {}),
      },
    });
  }

  /**
   * Layer 3A: Validate segregation of duties — the request creator
   * cannot be the approver (even if delegated).
   *
   * Returns the delegated approver if the original approver is the same
   * as the request creator.
   */
  async validateSegregationOfDuties(
    requestCreatedBy: string,
    currentApproverId: string,
    approvalType?: string,
  ): Promise<{ allowed: boolean; reason?: string; delegatedTo?: string }> {
    if (requestCreatedBy !== currentApproverId) {
      return { allowed: true };
    }

    // Same person — try to find a delegation
    const delegation = await this.findActiveDelegation(currentApproverId, approvalType);

    if (delegation) {
      this.logger.log(
        `Segregation of duties: Approval delegated from ${currentApproverId} to ${delegation.toUserId}`,
      );
      return {
        allowed: false,
        reason: 'Người tạo không thể tự duyệt. Đã ủy quyền cho người khác.',
        delegatedTo: delegation.toUserId,
      };
    }

    return {
      allowed: false,
      reason: 'Người tạo yêu cầu không thể tự duyệt. Cần người khác duyệt.',
    };
  }
}
