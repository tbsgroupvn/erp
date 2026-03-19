import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { Throttle } from '@nestjs/throttler';
import { FileValidationPipe } from '@common/pipes/file-validation.pipe';
import { FILE_UPLOAD_LIMITS } from '@common/constants/file-upload.constants';
import { BatchJobType, BatchJobPayload } from './batch-job.types';
import { BatchExportDto } from './dto/batch-export.dto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

@ApiTags('Batch')
@ApiBearerAuth()
@Controller('batch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(
    @InjectQueue('batch-jobs') private readonly batchQueue: Queue,
  ) {}

  @Post('import/orders')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importOrders(
    @UploadedFile(new FileValidationPipe({
      maxSizeBytes: FILE_UPLOAD_LIMITS.BATCH_IMPORT.maxSizeBytes,
      allowedMimeTypes: [...FILE_UPLOAD_LIMITS.BATCH_IMPORT.allowedMimeTypes],
    }))
    file: Express.Multer.File,
    @CurrentUser() user: ICurrentUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Save to temp directory
    const tempDir = join(tmpdir(), 'tbs-batch-imports');
    await mkdir(tempDir, { recursive: true });
    const filePath = join(tempDir, `${Date.now()}-${file.originalname}`);
    await writeFile(filePath, file.buffer);

    const job = await this.batchQueue.add(
      BatchJobType.IMPORT_ORDERS,
      {
        type: BatchJobType.IMPORT_ORDERS,
        userId: user.id,
        filePath,
      } satisfies BatchJobPayload,
      {
        attempts: 1, // Import should NOT auto-retry (may cause duplicates)
      },
    );

    return {
      jobId: String(job.id),
      message: 'Import đơn hàng đã được đưa vào hàng đợi xử lý',
    };
  }

  @Post('export/orders')
  async exportOrders(
    @Body() filters: BatchExportDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const job = await this.batchQueue.add(
      BatchJobType.EXPORT_ORDERS,
      {
        type: BatchJobType.EXPORT_ORDERS,
        userId: user.id,
        filters: { ...filters } as Record<string, unknown>,
        format: filters.format ?? 'XLSX',
      } satisfies BatchJobPayload,
    );

    return {
      jobId: String(job.id),
      message: 'Export đơn hàng đã được đưa vào hàng đợi',
    };
  }

  @Post('export/ar-report')
  async exportARReport(
    @Body() filters: BatchExportDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const job = await this.batchQueue.add(
      BatchJobType.EXPORT_AR_REPORT,
      {
        type: BatchJobType.EXPORT_AR_REPORT,
        userId: user.id,
        filters: { ...filters } as Record<string, unknown>,
        format: filters.format ?? 'XLSX',
      } satisfies BatchJobPayload,
    );

    return {
      jobId: String(job.id),
      message: 'Export công nợ đã được đưa vào hàng đợi',
    };
  }

  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.batchQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    return {
      id: job.id,
      type: job.data.type,
      state,
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
    };
  }
}
