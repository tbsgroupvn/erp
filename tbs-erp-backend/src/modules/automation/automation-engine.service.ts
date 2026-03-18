import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';
import { PrismaService } from '@core/database/prisma.service';
import { EmailService } from '@core/email/email.service';
import { TriggerType, ActionType, NotificationChannel, NotificationType } from '@prisma/client';
import { TriggerConfig, ConditionConfig, ActionConfig } from './automation.types';

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Called when events happen in the system.
   * Finds all ACTIVE rules matching the event type, evaluates conditions,
   * and executes actions sequentially.
   */
  async triggerByEvent(
    eventType: TriggerType,
    context: Record<string, any>,
  ): Promise<void> {
    let rules: any[];
    try {
      rules = await this.prisma.automationRule.findMany({
        where: { status: 'ACTIVE' },
      });
    } catch (err) {
      this.logger.error('Failed to load automation rules', err);
      return;
    }

    for (const rule of rules) {
      const trigger = rule.trigger as TriggerConfig;
      if (trigger.type !== eventType) continue;

      const conditions = (rule.conditions ?? []) as ConditionConfig[];
      if (!this.evaluateConditions(conditions, context)) {
        this.logger.debug(`Rule ${rule.id} conditions not met, skipping`);
        continue;
      }

      this.logger.log(`Executing automation rule "${rule.name}" (${rule.id})`);
      await this.executeActions(rule.id, rule.actions as ActionConfig[], context);
    }
  }

  /**
   * Public entry point to run a list of actions directly (used by manual trigger).
   */
  async runActions(
    actions: ActionConfig[],
    context: Record<string, any>,
  ): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action, context);
    }
  }

  // ---------------------------------------------------------------------------
  // Condition evaluation
  // ---------------------------------------------------------------------------

  private evaluateConditions(
    conditions: ConditionConfig[],
    context: Record<string, any>,
  ): boolean {
    for (const cond of conditions) {
      const actual = this.getNestedValue(context, cond.field);
      if (!this.evalCondition(actual, cond.operator, cond.value)) {
        return false;
      }
    }
    return true;
  }

  private evalCondition(
    actual: any,
    operator: string,
    expected: any,
  ): boolean {
    switch (operator) {
      case 'eq':
        return String(actual) === String(expected);
      case 'neq':
        return String(actual) !== String(expected);
      case 'gt':
        return Number(actual) > Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'contains':
        return String(actual)
          .toLowerCase()
          .includes(String(expected).toLowerCase());
      case 'not_contains':
        return !String(actual)
          .toLowerCase()
          .includes(String(expected).toLowerCase());
      default:
        return true;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  // ---------------------------------------------------------------------------
  // Action execution
  // ---------------------------------------------------------------------------

  private async executeActions(
    ruleId: string,
    actions: ActionConfig[],
    context: Record<string, any>,
  ): Promise<void> {
    const start = Date.now();
    let status = 'SUCCESS';
    let errorMsg: string | undefined;

    try {
      for (const action of actions) {
        await this.executeAction(action, context);
      }
    } catch (err) {
      status = 'FAILED';
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Automation rule ${ruleId} action failed: ${errorMsg}`);
    }

    try {
      await this.prisma.automationExecution.create({
        data: {
          ruleId,
          triggeredBy: context['triggeredBy'] as string | undefined,
          status,
          input: context,
          errorMsg,
          durationMs: Date.now() - start,
        },
      });

      // When status is FAILED: set rule to ERROR.
      // When status is SUCCESS and rule was previously ERROR: auto-recover to ACTIVE.
      // This prevents a transient failure from permanently blocking the rule.
      let statusUpdate: Record<string, any> | undefined;
      if (status === 'FAILED') {
        statusUpdate = { status: 'ERROR' };
      } else {
        // SUCCESS — fetch current rule status to decide if recovery is needed
        const currentRule = await this.prisma.automationRule.findUnique({
          where: { id: ruleId },
          select: { status: true },
        });
        if (currentRule?.status === 'ERROR') {
          statusUpdate = { status: 'ACTIVE' };
          this.logger.log(`Automation rule ${ruleId} recovered from ERROR to ACTIVE after successful execution`);
        }
      }

      await this.prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
          lastError: errorMsg ?? null,
          ...(statusUpdate ?? {}),
        },
      });
    } catch (logErr) {
      this.logger.error(`Failed to log automation execution for rule ${ruleId}`, logErr);
    }
  }

  private async executeAction(
    action: ActionConfig,
    context: Record<string, any>,
  ): Promise<void> {
    const p = action.params ?? {};

    switch (action.type) {
      case ActionType.SEND_NOTIFICATION: {
        if (p.userId) {
          await this.prisma.notification.create({
            data: {
              userId: p.userId,
              title: 'Automation',
              body: this.interpolate(p.message ?? '', context),
              type: NotificationType.SYSTEM,
              channel: NotificationChannel.APP_PUSH,
            },
          });
        }
        break;
      }

      case ActionType.CREATE_TASK: {
        const createdById =
          (context['userId'] as string | undefined) ?? p.assigneeId;
        if (!createdById || !p.assigneeId) {
          this.logger.warn('CREATE_TASK action skipped: no createdById or assigneeId');
          break;
        }
        const code = await this.generateTaskCode();
        await this.prisma.task.create({
          data: {
            code,
            title: this.interpolate(p.title ?? 'Auto task', context),
            assigneeId: p.assigneeId,
            priority: (p.priority as any) ?? 'MEDIUM',
            dueDate: p.dueInDays
              ? new Date(Date.now() + p.dueInDays * 86_400_000)
              : undefined,
            createdBy: createdById,
            status: 'OPEN',
          },
        });
        break;
      }

      case ActionType.WEBHOOK_CALL: {
        if (p.url) {
          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => controller.abort(), 10_000);
          try {
            const response = await fetch(p.url, {
              method: p.method ?? 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(context),
              signal: controller.signal,
            });
            if (!response.ok) {
              throw new DomainException(
                ErrorCode.AUTOMATION_ACTION_FAILED,
                `Webhook call to ${p.url} failed with status ${response.status}`,
                HttpStatus.BAD_GATEWAY,
              );
            }
          } finally {
            clearTimeout(timeoutHandle);
          }
        }
        break;
      }

      case ActionType.SEND_EMAIL: {
        if (p.to && p.subject) {
          const to = this.interpolate(String(p.to), context);
          const subject = this.interpolate(String(p.subject), context);
          const body = this.interpolate(String(p.body ?? ''), context);
          try {
            await this.emailService.send({
              to,
              subject,
              html: `<div style="font-family:sans-serif">${body.replace(/\n/g, '<br>')}</div>`,
            });
            this.logger.log(`[SEND_EMAIL] gui thanh cong toi ${to}`);
          } catch (emailErr) {
            this.logger.error(`[SEND_EMAIL] gui that bai toi ${to}: ${emailErr}`);
            throw emailErr;
          }
        } else {
          this.logger.warn('[SEND_EMAIL] thieu to hoac subject, bo qua');
        }
        break;
      }

      case ActionType.UPDATE_FIELD: {
        // Cap nhat truong du lieu tren entity (Order, Customer, Task)
        const entityType = String(p.entityType || '').toLowerCase();
        const entityId = this.interpolate(String(p.entityId ?? context['entityId'] ?? ''), context);
        const field = String(p.field || '');
        const value = String(p.value ?? '');

        if (!entityType || !entityId || !field) {
          this.logger.warn(`[UPDATE_FIELD] thieu entityType/entityId/field, bo qua`);
          break;
        }

        const updateData: Record<string, unknown> = { [field]: value };

        // Convert so neu can
        if (!isNaN(Number(value)) && value.trim() !== '') {
          updateData[field] = Number(value);
        }

        try {
          if (entityType === 'order') {
            await this.prisma.order.update({ where: { id: entityId }, data: updateData });
          } else if (entityType === 'customer') {
            await this.prisma.customer.update({ where: { id: entityId }, data: updateData });
          } else if (entityType === 'task') {
            await this.prisma.task.update({ where: { id: entityId }, data: updateData });
          } else {
            this.logger.warn(`[UPDATE_FIELD] entity "${entityType}" chua duoc ho tro`);
            break;
          }
          this.logger.log(`[UPDATE_FIELD] cap nhat ${entityType}.${field}=${value} cho ${entityId}`);
        } catch (updateErr) {
          this.logger.error(`[UPDATE_FIELD] that bai: ${updateErr}`);
          throw updateErr;
        }
        break;
      }

      case ActionType.ASSIGN_USER: {
        const assignEntityType = String(p.entityType || '').toLowerCase();
        const assignEntityId = this.interpolate(
          String(p.entityId ?? context['entityId'] ?? ''),
          context,
        );
        const assignUserId = this.interpolate(String(p.userId ?? ''), context);

        if (!assignEntityType || !assignEntityId || !assignUserId) {
          this.logger.warn('[ASSIGN_USER] thieu entityType/entityId/userId, bo qua');
          break;
        }

        try {
          if (assignEntityType === 'task') {
            await this.prisma.task.update({
              where: { id: assignEntityId },
              data: { assigneeId: assignUserId },
            });
          } else if (assignEntityType === 'order') {
            await this.prisma.order.update({
              where: { id: assignEntityId },
              data: { saleId: assignUserId },
            });
          } else {
            this.logger.warn(`[ASSIGN_USER] entity "${assignEntityType}" chua duoc ho tro`);
            break;
          }
          this.logger.log(
            `[ASSIGN_USER] gan ${assignUserId} vao ${assignEntityType} ${assignEntityId}`,
          );
        } catch (assignErr) {
          this.logger.error(`[ASSIGN_USER] that bai: ${assignErr}`);
          throw assignErr;
        }
        break;
      }

      default:
        this.logger.warn(`Unknown action type: ${(action as any).type}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Task code generator (TSK-YYYYMM-XXXX)
  // ---------------------------------------------------------------------------

  private async generateTaskCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `TSK-${yearMonth}`;

    const latest = await this.prisma.task.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() ?? '0', 10);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Template interpolation — replaces {{path.to.value}} placeholders
  // ---------------------------------------------------------------------------

  interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
      return String(this.getNestedValue(context, path) ?? '');
    });
  }
}
