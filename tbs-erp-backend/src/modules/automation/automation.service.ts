import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AutomationEngineService } from './automation-engine.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AutomationEngineService,
  ) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async createRule(userId: string, dto: CreateAutomationRuleDto) {
    const rule = await this.prisma.automationRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        conditions: dto.conditions ?? [],
        actions: dto.actions,
        createdBy: userId,
      },
    });
    this.logger.log(`Automation rule created: "${rule.name}" by ${userId}`);
    return rule;
  }

  async updateRule(
    userId: string,
    id: string,
    dto: UpdateAutomationRuleDto,
  ) {
    const rule = await this.findRuleOrThrow(id);
    this.assertOwner(rule, userId);

    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.trigger !== undefined && { trigger: dto.trigger }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions }),
        ...(dto.actions !== undefined && { actions: dto.actions }),
      },
    });
    this.logger.log(`Automation rule updated: "${updated.name}" by ${userId}`);
    return updated;
  }

  async deleteRule(userId: string, id: string) {
    const rule = await this.findRuleOrThrow(id);
    this.assertOwner(rule, userId);

    await this.prisma.automationRule.delete({ where: { id } });
    this.logger.log(`Automation rule deleted: "${rule.name}" by ${userId}`);
    return { deleted: true, id };
  }

  async getRules() {
    return this.prisma.automationRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { executions: true } },
      },
    });
  }

  async getRule(id: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!rule) throw new NotFoundException(`Automation rule ${id} not found`);
    return rule;
  }

  async getExecutions(ruleId: string, limit = 50) {
    await this.findRuleOrThrow(ruleId);
    return this.prisma.automationExecution.findMany({
      where: { ruleId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  // ---------------------------------------------------------------------------
  // Manual trigger (test run)
  // ---------------------------------------------------------------------------

  async manualTrigger(userId: string, ruleId: string) {
    const rule = await this.findRuleOrThrow(ruleId);

    const context: Record<string, any> = {
      triggeredBy: userId,
      userId,
      manual: true,
      timestamp: new Date().toISOString(),
    };

    // For MANUAL trigger type, force run. For others, bypass condition check.
    const start = Date.now();
    let status = 'SUCCESS';
    let errorMsg: string | undefined;

    try {
      const actions = rule.actions as any[];
      await this.engine.runActions(actions, context);
    } catch (err) {
      status = 'FAILED';
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
    }

    await this.prisma.automationExecution.create({
      data: {
        ruleId,
        triggeredBy: userId,
        status,
        input: context,
        errorMsg,
        durationMs: Date.now() - start,
      },
    });

    await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        lastError: errorMsg ?? null,
      },
    });

    this.logger.log(
      `Manual trigger for rule "${rule.name}" by ${userId}: ${status}`,
    );
    return { status, durationMs: Date.now() - start, errorMsg };
  }

  // ---------------------------------------------------------------------------
  // Stats helper
  // ---------------------------------------------------------------------------

  async getStats() {
    const [total, active, error] = await this.prisma.$transaction([
      this.prisma.automationRule.count(),
      this.prisma.automationRule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.automationRule.count({ where: { status: 'ERROR' } }),
    ]);
    return { total, active, error, inactive: total - active - error };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findRuleOrThrow(id: string) {
    const rule = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Automation rule ${id} not found`);
    return rule;
  }

  private assertOwner(rule: { createdBy: string }, userId: string) {
    if (rule.createdBy !== userId) {
      throw new ForbiddenException(
        'Only the creator can modify this automation rule',
      );
    }
  }
}
