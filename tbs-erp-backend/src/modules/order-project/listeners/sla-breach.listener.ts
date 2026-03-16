import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus } from '@prisma/client';

export interface SLABreachedEvent {
  orderId: string;
  assignmentId: string;
  stage: OrderStatus;
  departmentCode: string;
  assigneeId?: string | null;
  slaDeadline: Date;
}

/**
 * SLABreachListener reacts to 'order.assignment.sla.breached' events emitted
 * by SLACheckerService and dispatches urgent notifications.
 *
 * The handler is fire-and-forget. Any error is logged but never propagated.
 */
@Injectable()
export class SLABreachListener {
  private readonly logger = new Logger(SLABreachListener.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('order.assignment.sla.breached', { async: true })
  async handleSLABreach(event: SLABreachedEvent): Promise<void> {
    this.logger.warn(
      `SLA breached — order=${event.orderId} stage=${event.stage} dept=${event.departmentCode} assignee=${event.assigneeId ?? 'unassigned'}`,
    );

    try {
      // Emit notification event for the assignee (if known)
      this.eventEmitter.emit('notification.send', {
        userId: event.assigneeId ?? null,
        title: `Don hang qua han SLA - giai doan ${event.stage}`,
        body: `Assignment tai giai doan ${event.stage} da vuot qua thoi han xu ly.`,
        type: 'ALERT',
        referenceId: event.orderId,
        isUrgent: true,
      });

      // Also notify department managers by emitting a department-scoped alert
      this.eventEmitter.emit('notification.send.department', {
        departmentCode: event.departmentCode,
        title: `[SLA BREACH] Don hang ${event.orderId} - ${event.stage}`,
        body: `Don hang tai giai doan ${event.stage} trong bo phan ${event.departmentCode} da vuot qua thoi han SLA. Assignee: ${event.assigneeId ?? 'chua phan cong'}.`,
        type: 'ALERT',
        referenceId: event.orderId,
        isUrgent: true,
      });
    } catch (err) {
      // Non-blocking: never throw from event handlers
      this.logger.error(
        `SLA breach notification failed for order ${event.orderId}: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnEvent('order.assignment.sla.warning', { async: true })
  async handleSLAWarning(event: SLABreachedEvent & { warningHours?: number }): Promise<void> {
    this.logger.warn(
      `SLA warning — order=${event.orderId} stage=${event.stage} dept=${event.departmentCode}`,
    );

    try {
      this.eventEmitter.emit('notification.send', {
        userId: event.assigneeId ?? null,
        title: `Canh bao SLA - ${event.stage}`,
        body: `Don hang tai giai doan ${event.stage} sap het han xu ly. Vui long xu ly som.`,
        type: 'WARNING',
        referenceId: event.orderId,
        isUrgent: false,
      });
    } catch (err) {
      this.logger.error(
        `SLA warning notification failed for order ${event.orderId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
