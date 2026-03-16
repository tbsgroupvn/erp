import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class FlowDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.approvalFlowDefinition.findMany({
        skip,
        take: limit,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { nodes: true, edges: true, instances: true } } },
      }),
      this.prisma.approvalFlowDefinition.count(),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    return this.prisma.approvalFlowDefinition.findUnique({
      where: { id },
      include: {
        nodes: { include: { outgoingEdges: true, incomingEdges: true } },
        edges: true,
      },
    });
  }

  async findActiveByTriggerType(triggerType: string) {
    return this.prisma.approvalFlowDefinition.findFirst({
      where: {
        triggerType,
        isActive: true,
      },
      orderBy: { version: 'desc' },
      include: {
        nodes: { include: { outgoingEdges: true } },
        edges: true,
      },
    });
  }
}
