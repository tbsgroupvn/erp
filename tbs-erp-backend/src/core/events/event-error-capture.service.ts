import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeadLetterQueueService } from '@core/event-bus/dead-letter-queue.service';

/**
 * Global error handler for EventEmitter2 async events.
 *
 * Wraps `emitAsync` to automatically capture unhandled listener errors
 * into the persistent Dead Letter Queue (PostgreSQL-backed).
 *
 * Without this service, errors from event listeners using `emitAsync`
 * would propagate to the caller but never be recorded for later
 * inspection or retry.
 */
@Injectable()
export class EventErrorCaptureService implements OnModuleInit {
  private readonly logger = new Logger(EventErrorCaptureService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dlqService: DeadLetterQueueService,
  ) {}

  onModuleInit(): void {
    const originalEmitAsync = this.eventEmitter.emitAsync.bind(
      this.eventEmitter,
    );

    this.eventEmitter.emitAsync = async (
      event: string | string[],
      ...args: any[]
    ): Promise<any[]> => {
      try {
        return await originalEmitAsync(event, ...args);
      } catch (error) {
        const eventName = Array.isArray(event) ? event.join('.') : event;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Event handler error for '${eventName}': ${errorMessage}`,
        );

        // Persist to DLQ for manual inspection / retry
        await this.dlqService.addToDeadLetterQueue(
          eventName,
          args[0] || {},
          errorMessage,
          'event_emitter',
        );

        // Re-throw so callers know about the error
        throw error;
      }
    };

    this.logger.log(
      'EventEmitter2.emitAsync wrapped with DLQ auto-capture error handler',
    );
  }
}
