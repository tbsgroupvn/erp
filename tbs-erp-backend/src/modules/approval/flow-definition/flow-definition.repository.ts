import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class FlowDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.approvalFlowDefinition.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { nodes: true, edges: true, instances: true } } },
    });
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
