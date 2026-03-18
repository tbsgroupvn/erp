import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface DeferredEvent {
  eventName: string;
  payload: any;
}

export interface EventCollector {
  /** Buffer an event for later emission. Call inside $transaction. */
  emit: (eventName: string, payload: any) => void;
  /** Emit all buffered events. Call AFTER $transaction resolves. */
  flush: () => void;
  /** Discard all buffered events. Called implicitly on tx failure (or explicitly). */
  discard: () => void;
}

@Injectable()
export class TransactionalEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Creates a collector that buffers events during a Prisma transaction.
   *
   * Usage:
   *   const collector = this.txEmitter.createCollector();
   *   const result = await this.prisma.executeInTransaction(async (tx) => {
   *     // ... writes using tx ...
   *     collector.emit('event.name', payload);
   *     return result;
   *   });
   *   collector.flush(); // Only after tx commits
   */
  createCollector(): EventCollector {
    const buffer: DeferredEvent[] = [];
    return {
      emit: (eventName: string, payload: any) => {
        buffer.push({ eventName, payload });
      },
      flush: () => {
        for (const { eventName, payload } of buffer) {
          this.eventEmitter.emit(eventName, payload);
        }
        buffer.length = 0;
      },
      discard: () => {
        buffer.length = 0;
      },
    };
  }
}
