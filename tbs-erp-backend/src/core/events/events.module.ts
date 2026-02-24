import { Module } from '@nestjs/common';
import { QueueModule } from '@core/queue/queue.module';
import { EventPublisherService } from './event-publisher.service';

/**
 * Events module that re-exports the EventPublisherService for convenience.
 *
 * Domain modules can import this module to gain access to the event publisher
 * without needing to import the full QueueModule directly.
 */
@Module({
  imports: [QueueModule],
  exports: [EventPublisherService],
})
export class EventsModule {}
