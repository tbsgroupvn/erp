import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DlqMonitorService } from '@core/events/dlq-monitor.service';
import { EventErrorCaptureService } from '@core/events/event-error-capture.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      verboseMemoryLeak: true,
      maxListeners: 100,
      ignoreErrors: false,
    }),
  ],
  providers: [DeadLetterQueueService, DlqMonitorService, EventErrorCaptureService],
  exports: [EventEmitterModule, DeadLetterQueueService],
})
export class EventBusModule {}
