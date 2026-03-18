import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  DomainEventType,
  NotificationSendPayload,
  NotificationBroadcastPayload,
} from '../domain-events';
import { logProcessorError } from './processor-error.util';

/**
 * Processes notification-related domain events from the 'notification-events' queue.
 *
 * Handles:
 * - Individual user notifications (in-app, email, SMS)
 * - Broadcast notifications (to roles, branches, all users)
 * - Approval-related notifications
 *
 * All processing is idempotent.
 */
@Processor('notification-events')
export class NotificationEventProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEventProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;
    this.logger.log(
      `Processing ${event.type} (jobId: ${job.id}, ` +
        `correlationId: ${event.metadata.correlationId})`,
    );

    try {
      switch (event.type) {
        case DomainEventType.NOTIFICATION_SEND:
          await this.handleSendNotification(event as DomainEvent<NotificationSendPayload>);
          break;

        case DomainEventType.NOTIFICATION_BROADCAST:
          await this.handleBroadcast(event as DomainEvent<NotificationBroadcastPayload>);
          break;

        case DomainEventType.NOTIFICATION_EMAIL:
          await this.handleEmailNotification(event);
          break;

        case DomainEventType.NOTIFICATION_SMS:
          await this.handleSmsNotification(event);
          break;

        case DomainEventType.APPROVAL_REQUESTED:
          await this.handleApprovalRequested(event);
          break;

        case DomainEventType.APPROVAL_APPROVED:
        case DomainEventType.APPROVAL_REJECTED:
          await this.handleApprovalDecision(event);
          break;

        default:
          this.logger.warn(`Unhandled notification event type: ${event.type}`);
      }
    } catch (error) {
      logProcessorError(this.logger, job, error);
      throw error; // Re-throw so BullMQ can retry
    }
  }

  /**
   * Send a notification to a specific user via the in-process notification service.
   */
  private async handleSendNotification(event: DomainEvent<NotificationSendPayload>): Promise<void> {
    const { userId, title, body, type, channel, referenceId, isUrgent, data } = event.payload;

    this.logger.log(`Sending notification to user ${userId}: "${title}"`);

    // Forward to in-process notification service listener
    this.eventEmitter.emit('notification.dispatch', {
      userId,
      title,
      body,
      type,
      channel: channel ?? 'APP_PUSH',
      referenceId,
      isUrgent,
      data,
    });

    // Also emit WebSocket event for real-time delivery
    this.eventEmitter.emit('ws.emit.user', {
      userId,
      event: 'notification',
      data: { title, body, type, referenceId, isUrgent },
    });
  }

  /**
   * Broadcast a notification to a role, branch, or all users.
   */
  private async handleBroadcast(event: DomainEvent<NotificationBroadcastPayload>): Promise<void> {
    const { targetRole, targetBranch, title, body, type, data } = event.payload;

    this.logger.log(
      `Broadcasting notification: "${title}" ` +
        `(role: ${targetRole ?? 'all'}, branch: ${targetBranch ?? 'all'})`,
    );

    if (targetRole) {
      this.eventEmitter.emit('ws.emit.role', {
        role: targetRole,
        event: 'notification',
        data: { title, body, type, ...data },
      });
    } else if (targetBranch) {
      this.eventEmitter.emit('ws.emit.branch', {
        branch: targetBranch,
        event: 'notification',
        data: { title, body, type, ...data },
      });
    } else {
      this.eventEmitter.emit('ws.emit.all', {
        event: 'notification',
        data: { title, body, type, ...data },
      });
    }
  }

  private async handleEmailNotification(event: DomainEvent): Promise<void> {
    this.logger.log(
      `Processing email notification (correlationId: ${event.metadata.correlationId})`,
    );
    this.eventEmitter.emit('email.send', event.payload);
  }

  private async handleSmsNotification(event: DomainEvent): Promise<void> {
    this.logger.log(`Processing SMS notification (correlationId: ${event.metadata.correlationId})`);
    this.eventEmitter.emit('sms.send', event.payload);
  }

  private async handleApprovalRequested(event: DomainEvent): Promise<void> {
    this.logger.log(`Approval requested: ${event.metadata.aggregateId}`);
    const { approverId, requestType, title } = event.payload as any;

    this.eventEmitter.emit('ws.emit.user', {
      userId: approverId,
      event: 'approval_requested',
      data: { requestType, title, id: event.metadata.aggregateId },
    });
  }

  private async handleApprovalDecision(event: DomainEvent): Promise<void> {
    const decision = event.type === DomainEventType.APPROVAL_APPROVED ? 'approved' : 'rejected';
    this.logger.log(`Approval ${decision}: ${event.metadata.aggregateId}`);

    const { requesterId } = event.payload as any;
    this.eventEmitter.emit('ws.emit.user', {
      userId: requesterId,
      event: `approval_${decision}`,
      data: { id: event.metadata.aggregateId },
    });
  }
}
