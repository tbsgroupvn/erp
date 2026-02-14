import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

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
      // Do not throw on error events without a listener
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class EventBusModule {}
