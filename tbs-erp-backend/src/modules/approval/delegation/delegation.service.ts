import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.approvalDelegation.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateDelegationDto, userId: string) {
    return this.prisma.approvalDelegation.create({
      data: {
        fromUserId: userId,
        toUserId: dto.toUserId,
        approvalTypes: dto.approvalTypes ?? [],
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
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
      throw new NotFoundException('Only the delegator can deactivate');
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
        OR: [
          { approvalTypes: { isEmpty: true } },
          ...(approvalType
            ? [{ approvalTypes: { has: approvalType } }]
            : []),
        ],
      },
    });
  }
}
