import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { DocumentExtractionService } from './ocr/document-extraction.service';
import { DocumentExtractionProcessor } from './ocr/document-extraction.processor';
import { AiGuardrailsService } from './guards/ai-guardrails.service';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';

@Module({
  imports: [BullModule.registerQueue({ name: 'ai-ocr-jobs' })],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    DocumentExtractionService,
    DocumentExtractionProcessor,
    AiGuardrailsService,
    AiRateLimitGuard,
  ],
  exports: [AiAssistantService, DocumentExtractionService, AiGuardrailsService, AiRateLimitGuard],
})
export class AiAssistantModule {}
