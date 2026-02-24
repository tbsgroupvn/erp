import { Module, Logger } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

const logger = new Logger('EventBus');

/**
 * Dead letter queue (DLQ) for failed events.
 *
 * In-memory DLQ stores events that failed processing so they can be
 * retried or inspected. In production, this should be backed by a
 * persistent store (e.g., Redis list, database table, or a dedicated
 * message queue like RabbitMQ/SQS).
 */
export interface DeadLetterEntry {
  event: string;
  payload: unknown;
  error: string;
  timestamp: Date;
  retryCount: number;
}

/** Maximum number of DLQ entries to keep in memory. */
const MAX_DLQ_SIZE = 1000;

/** Maximum retries for failed events before sending to DLQ. */
const MAX_EVENT_RETRIES = 3;

/** In-memory dead letter queue. */
const deadLetterQueue: DeadLetterEntry[] = [];

/**
 * Adds a failed event to the dead letter queue.
 * Evicts oldest entries when the queue exceeds MAX_DLQ_SIZE.
 */
export function addToDeadLetterQueue(
  event: string,
  payload: unknown,
  error: string,
): void {
  deadLetterQueue.push({
    event,
    payload,
    error,
    timestamp: new Date(),
    retryCount: 0,
  });

  // Evict oldest entries if queue is full
  while (deadLetterQueue.length > MAX_DLQ_SIZE) {
    deadLetterQueue.shift();
  }

  logger.warn(
    `Event added to dead letter queue: ${event} (DLQ size: ${deadLetterQueue.length})`,
  );
}

/**
 * Returns the current dead letter queue entries (for monitoring/debugging).
 */
export function getDeadLetterQueue(): ReadonlyArray<DeadLetterEntry> {
  return deadLetterQueue;
}

/**
 * Clears processed entries from the dead letter queue.
 */
export function clearDeadLetterQueue(): number {
  const count = deadLetterQueue.length;
  deadLetterQueue.length = 0;
  return count;
}

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Use wildcards so listeners can subscribe to event namespaces
      // e.g., 'order.*' catches order.created, order.status.changed, etc.
      wildcard: true,
      // The delimiter used for namespaced events
      delimiter: '.',
      // Show a warning when a listener throws an error instead of crashing
      verboseMemoryLeak: true,
      // Maximum number of listeners per event (0 = unlimited)
      maxListeners: 20,
      // Do not throw on error events without a listener — failed events
      // are captured by the global error handler and routed to the DLQ
      ignoreErrors: true,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventBusModule {}
