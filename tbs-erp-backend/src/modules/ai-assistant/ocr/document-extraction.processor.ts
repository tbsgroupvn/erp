import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentExtractionService } from './document-extraction.service';
import { ExtractDocumentDto, PackingListResult } from './dto/extract-document.dto';

export interface OCRJobData {
  userId: string;
  dto: ExtractDocumentDto;
}

export interface OCRJobResult {
  success: boolean;
  result?: PackingListResult;
  error?: string;
}

@Processor('ai-ocr-jobs')
export class DocumentExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentExtractionProcessor.name);

  constructor(private readonly extractionService: DocumentExtractionService) {
    super();
  }

  async process(job: Job<OCRJobData>): Promise<OCRJobResult> {
    this.logger.log(
      `Xu ly OCR job ${job.id}: type=${job.data.dto.type}, userId=${job.data.userId}`,
    );

    try {
      const result = await this.extractionService.extractDocument(job.data.dto);

      this.logger.log(
        `OCR job ${job.id} hoan tat: ${result.totalItems} san pham boc tach`,
      );

      return { success: true, result };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`OCR job ${job.id} that bai: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }
}
