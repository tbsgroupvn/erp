import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { FlowDefinitionRepository } from './flow-definition.repository';
import { CreateFlowDefinitionDto } from './dto/create-flow-definition.dto';
import { UpdateFlowDefinitionDto } from './dto/update-flow-definition.dto';
import { ApprovalType, ApprovalCategory, Prisma } from '@prisma/client';
import { ApprovalGraphEngine } from '../domain/approval-graph-engine';

@Injectable()
export class FlowDefinitionService {
  private readonly logger = new Logger(FlowDefinitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowDefRepo: FlowDefinitionRepository,
    private readonly graphEngine: ApprovalGraphEngine,
  ) { }

  async findAll() {
    return this.flowDefRepo.findAll();
  }

  async findById(id: string) {
    const flowDef = await this.flowDefRepo.findById(id);
    if (!flowDef) {
      throw new NotFoundException(`Flow definition ${id} not found`);
    }
    return flowDef;
  }

  async create(dto: CreateFlowDefinitionDto, userId: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const flowDef = await tx.approvalFlowDefinition.create({
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category as ApprovalCategory,
          triggerType: dto.triggerType,
          isActive: dto.isActive ?? true,
          formSchema: dto.formSchema as any,
          createdBy: userId,
        },
      });

      // Create nodes
      const nodeIdMap = new Map<string, string>();
      for (const node of dto.nodes) {
        const created = await tx.approvalFlowNode.create({
          data: {
            flowDefinitionId: flowDef.id,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            label: node.label,
            approverType: node.approverType,
            approverRole: node.approverRole,
            approverUserId: node.approverUserId,
            approvalMode: node.approvalMode,
            conditionField: node.conditionField,
            conditionOperator: node.conditionOperator,
            conditionValue: node.conditionValue,
            deadlineHours: node.deadlineHours,
            autoAction: node.autoAction,
            fieldPermissions: node.fieldPermissions as any,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        nodeIdMap.set(node.nodeKey, created.id);
      }

      // Create edges
      for (const edge of dto.edges) {
        const sourceId = nodeIdMap.get(edge.sourceNodeKey);
        const targetId = nodeIdMap.get(edge.targetNodeKey);

        if (!sourceId || !targetId) {
          throw new BadRequestException(
            `Invalid edge: ${edge.sourceNodeKey} → ${edge.targetNodeKey}. Node not found.`,
          );
        }

        await tx.approvalFlowEdge.create({
          data: {
            flowDefinitionId: flowDef.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label: edge.label,
            conditionExpression: edge.conditionExpression,
            sortOrder: edge.sortOrder ?? 0,
          },
        });
      }

      this.logger.log(
        `Created flow definition: ${flowDef.name} (${flowDef.id})`,
      );

      return this.flowDefRepo.findById(flowDef.id);
    });
  }

  async update(id: string, dto: UpdateFlowDefinitionDto) {
    const existing = await this.flowDefRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Flow definition ${id} not found`);
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Update basic fields
      await tx.approvalFlowDefinition.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category as ApprovalCategory,
          triggerType: dto.triggerType,
          isActive: dto.isActive,
          formSchema: dto.formSchema as any,
        },
      });

      // If nodes/edges provided, recreate them
      if (dto.nodes && dto.edges) {
        // Delete existing nodes and edges (cascade)
        await tx.approvalFlowEdge.deleteMany({
          where: { flowDefinitionId: id },
        });
        await tx.approvalFlowNode.deleteMany({
          where: { flowDefinitionId: id },
        });

        // Recreate nodes
        const nodeIdMap = new Map<string, string>();
        for (const node of dto.nodes) {
          const created = await tx.approvalFlowNode.create({
            data: {
              flowDefinitionId: id,
              nodeKey: node.nodeKey,
              nodeType: node.nodeType,
              label: node.label,
              approverType: node.approverType,
              approverRole: node.approverRole,
              approverUserId: node.approverUserId,
              approvalMode: node.approvalMode,
              conditionField: node.conditionField,
              conditionOperator: node.conditionOperator,
              conditionValue: node.conditionValue,
              deadlineHours: node.deadlineHours,
              autoAction: node.autoAction,
              fieldPermissions: node.fieldPermissions as any,
              positionX: node.positionX,
              positionY: node.positionY,
            },
          });
          nodeIdMap.set(node.nodeKey, created.id);
        }

        // Recreate edges
        for (const edge of dto.edges) {
          const sourceId = nodeIdMap.get(edge.sourceNodeKey);
          const targetId = nodeIdMap.get(edge.targetNodeKey);

          if (!sourceId || !targetId) {
            throw new BadRequestException(
              `Invalid edge: ${edge.sourceNodeKey} → ${edge.targetNodeKey}`,
            );
          }

          await tx.approvalFlowEdge.create({
            data: {
              flowDefinitionId: id,
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              label: edge.label,
              conditionExpression: edge.conditionExpression,
              sortOrder: edge.sortOrder ?? 0,
            },
          });
        }
      }

      return this.flowDefRepo.findById(id);
    });
  }

  async createVersion(id: string, userId: string) {
    const existing = await this.flowDefRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Flow definition ${id} not found`);
    }

    // Deactivate old version
    await this.prisma.approvalFlowDefinition.update({
      where: { id },
      data: { isActive: false },
    });

    // Create new version
    return this.prisma.executeInTransaction(async (tx) => {
      const newFlowDef = await tx.approvalFlowDefinition.create({
        data: {
          name: existing.name,
          description: existing.description,
          category: existing.category,
          triggerType: existing.triggerType,
          isActive: true,
          version: existing.version + 1,
          formSchema: existing.formSchema as any,
          createdBy: userId,
        },
      });

      // Copy nodes
      const nodeIdMap = new Map<string, string>();
      for (const node of existing.nodes) {
        const created = await tx.approvalFlowNode.create({
          data: {
            flowDefinitionId: newFlowDef.id,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            label: node.label,
            approverType: node.approverType,
            approverRole: node.approverRole,
            approverUserId: node.approverUserId,
            approvalMode: node.approvalMode,
            conditionField: node.conditionField,
            conditionOperator: node.conditionOperator,
            conditionValue: node.conditionValue,
            deadlineHours: node.deadlineHours,
            autoAction: node.autoAction,
            fieldPermissions: node.fieldPermissions as any,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        nodeIdMap.set(node.id, created.id);
      }

      // Copy edges (with the node ID map)
      for (const edge of existing.edges) {
        const sourceId = nodeIdMap.get(edge.sourceNodeId);
        const targetId = nodeIdMap.get(edge.targetNodeId);
        if (sourceId && targetId) {
          await tx.approvalFlowEdge.create({
            data: {
              flowDefinitionId: newFlowDef.id,
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              label: edge.label,
              conditionExpression: edge.conditionExpression,
              sortOrder: edge.sortOrder,
            },
          });
        }
      }

      return this.flowDefRepo.findById(newFlowDef.id);
    });
  }

  async deactivate(id: string) {
    const existing = await this.flowDefRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Flow definition ${id} not found`);
    }

    return this.prisma.approvalFlowDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async testFlow(id: string, requestData: Record<string, unknown>, userId: string) {
    return this.graphEngine.testFlow(id, requestData, userId);
  }
}
