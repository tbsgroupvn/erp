import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Sse,
  UseGuards,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Observable, from, map } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { PrismaService } from '@core/database/prisma.service';
import { AiAssistantService } from './ai-assistant.service';
import { DocumentExtractionService } from './ocr/document-extraction.service';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { ChatDto } from './dto/chat.dto';
import {
  ExtractDocumentDto,
  BatchExtractDocumentDto,
  CorrectOcrResultDto,
} from './ocr/dto/extract-document.dto';

// AI Assistant: tat ca roles NGOAI TRU DRIVER, WAREHOUSE_CN_AGENT, WAREHOUSE_VN_STAFF
// (Ba nhom nay dung mobile app thay the)
const AI_ALLOWED_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.COO,
  UserRole.CFO,
  UserRole.DIRECTOR_OPERATIONS,
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
  UserRole.MARKETING_STAFF,
  UserRole.CSKH,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
  UserRole.ACCOUNTANT_COST,
  UserRole.HR_MANAGER,
  UserRole.LOGISTICS_MANAGER,
  UserRole.XNK_MANAGER,
  UserRole.XNK_STAFF,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.WAREHOUSE_VN_MANAGER,
];

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...AI_ALLOWED_ROLES)
@Controller('ai')
export class AiAssistantController {
  private readonly logger = new Logger(AiAssistantController.name);

  constructor(
    private readonly aiService: AiAssistantService,
    private readonly extractionService: DocumentExtractionService,
    private readonly prisma: PrismaService,
    @InjectQueue('ai-ocr-jobs') private readonly ocrQueue: Queue,
  ) {}

  // ----------------------------------------------------------------
  // Phien hoi thoai
  // ----------------------------------------------------------------

  @Get('sessions')
  @ApiOperation({ summary: 'Danh sach phien chat AI', description: 'Tra ve 20 phien gan nhat cua user hien tai.' })
  @ApiResponse({ status: 200, description: 'Lay danh sach phien thanh cong' })
  async getSessions(@CurrentUser() user: ICurrentUser) {
    const sessions = await this.aiService.getSessions(user.id);
    return BaseResponse.ok(sessions);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao phien chat AI moi' })
  @ApiResponse({ status: 201, description: 'Tao phien thanh cong' })
  async createSession(@CurrentUser() user: ICurrentUser) {
    const session = await this.aiService.createSession(user.id);
    return BaseResponse.ok(session, 'Tao phien thanh cong');
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoa phien chat AI' })
  @ApiParam({ name: 'id', description: 'Ma phien' })
  @ApiResponse({ status: 200, description: 'Xoa phien thanh cong' })
  async deleteSession(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    await this.aiService.deleteSession(user.id, id);
    return BaseResponse.ok(null, 'Xoa phien thanh cong');
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Lay tin nhan cua phien' })
  @ApiParam({ name: 'id', description: 'Ma phien' })
  @ApiResponse({ status: 200, description: 'Lay tin nhan thanh cong' })
  async getMessages(@CurrentUser() user: ICurrentUser, @Param('id') id: string) {
    const messages = await this.aiService.getMessages(user.id, id);
    return BaseResponse.ok(messages);
  }

  // ----------------------------------------------------------------
  // Chat — khong streaming
  // ----------------------------------------------------------------

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  @ApiOperation({
    summary: 'Gui tin nhan (khong streaming)',
    description: 'Gui tin nhan va doi AI tra loi day du.',
  })
  @ApiResponse({ status: 200, description: 'AI tra loi thanh cong' })
  @ApiResponse({ status: 429, description: 'Vuot gioi han yeu cau AI (30/gio hoac 5/phut)' })
  async chat(@CurrentUser() user: ICurrentUser, @Body() dto: ChatDto) {
    const result = await this.aiService.chat(user.id, dto.sessionId ?? '', dto.message);
    return BaseResponse.ok(result);
  }

  // ----------------------------------------------------------------
  // Chat — SSE streaming
  // ----------------------------------------------------------------

  @Get('stream')
  @Sse()
  @UseGuards(AiRateLimitGuard)
  @ApiOperation({
    summary: 'Stream phan hoi AI (SSE)',
    description:
      'Mo ket noi Server-Sent Events. Stream tung doan text khi AI sinh ra. ' +
      'Events: { type: "session", sessionId } | { type: "tool_use", name, status } | ' +
      '{ type: "tool_result", name, preview } | { type: "text", text } | { type: "done", tokensUsed }',
  })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Ma phien (bo qua de tao moi)' })
  @ApiQuery({ name: 'message', required: true, description: 'Tin nhan nguoi dung' })
  @ApiResponse({ status: 200, description: 'SSE stream' })
  @ApiResponse({ status: 429, description: 'Vuot gioi han yeu cau AI' })
  chatStream(
    @CurrentUser() user: ICurrentUser,
    @Query('sessionId') sessionId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    const generator = this.aiService.chatStream(user.id, sessionId ?? '', message ?? '');
    return from(generator).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }

  // ----------------------------------------------------------------
  // Boc tach chung tu (OCR)
  // ----------------------------------------------------------------

  @Post('extract-document')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  @ApiOperation({
    summary: 'Boc tach du lieu tu anh chung tu (OCR)',
    description:
      'Upload anh dang base64 cua Packing List, Hoa don, hoac To khai Hai quan. ' +
      'AI (Claude Vision) boc tach du lieu co cau truc: ma van don, ten hang (TQ→VN), so luong, can nang.',
  })
  @ApiResponse({ status: 200, description: 'Boc tach thanh cong' })
  @ApiResponse({ status: 400, description: 'Anh khong hop le hoac sai loai chung tu' })
  @ApiResponse({ status: 429, description: 'Vuot gioi han yeu cau AI' })
  async extractDocument(@CurrentUser() user: ICurrentUser, @Body() dto: ExtractDocumentDto) {
    const result = await this.extractionService.extractDocument(dto);
    // Audit log cho extract-document (non-blocking)
    this.logOcrAudit(user.id, 'single', result.totalItems).catch(() => {});
    return BaseResponse.ok(result, `Boc tach ${result.totalItems} san pham`);
  }

  @Post('extract-document/batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  @ApiOperation({
    summary: 'Boc tach nhieu anh chung tu cung luc (batch OCR)',
    description:
      'Xu ly toi da 10 anh song song bang Promise.allSettled. ' +
      'Tra ve ket qua tong hop: so anh thanh cong, so anh that bai, chi tiet tung anh.',
  })
  @ApiResponse({ status: 200, description: 'Batch OCR hoan tat (co the co mot so anh that bai)' })
  @ApiResponse({ status: 400, description: 'Du lieu dau vao khong hop le' })
  @ApiResponse({ status: 429, description: 'Vuot gioi han yeu cau AI' })
  async batchExtractDocument(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: BatchExtractDocumentDto,
  ) {
    const result = await this.extractionService.extractMultipleDocuments(dto.images);
    // Audit log batch OCR (non-blocking)
    this.logOcrAudit(user.id, 'batch', result.succeeded, result.total).catch(() => {});
    return BaseResponse.ok(
      result,
      `Batch OCR hoan tat: ${result.succeeded}/${result.total} anh thanh cong`,
    );
  }

  @Post('extract-document/correct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chinh sua ket qua OCR truoc khi apply',
    description:
      'Cho phep user chinh sua cac truong trong ket qua OCR (items, totalWeightKg, shipper, v.v.) ' +
      'truoc khi ap dung vao don hang. He thong se tinh lai totalItems va totalWeightKg tu items moi.',
  })
  @ApiResponse({ status: 200, description: 'Ap dung chinh sua thanh cong' })
  @ApiResponse({ status: 400, description: 'Du lieu chinh sua khong hop le' })
  async correctOcrResult(
    @CurrentUser() _user: ICurrentUser,
    @Body() dto: CorrectOcrResultDto,
  ) {
    const corrected = this.extractionService.validateAndCorrectResult(
      dto.originalResult,
      dto.corrections,
    );
    return BaseResponse.ok(corrected, `Da chinh sua ket qua OCR: ${corrected.totalItems} san pham`);
  }

  @Post('extract-document/async')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Xep hang OCR job (xu ly nen)',
    description:
      'Dua OCR job vao hang doi xu ly nen. Tra ve jobId de theo doi trang thai.',
  })
  @ApiResponse({ status: 202, description: 'Job da duoc xep hang' })
  async extractDocumentAsync(@CurrentUser() user: ICurrentUser, @Body() dto: ExtractDocumentDto) {
    const job = await this.ocrQueue.add('extract', { userId: user.id, dto }, { attempts: 2 });
    return BaseResponse.ok({ jobId: job.id }, 'OCR job da duoc xep hang');
  }

  @Get('extract-document/job/:jobId')
  @ApiOperation({
    summary: 'Lay trang thai OCR job',
    description: 'Tra ve trang thai va ket qua cua OCR job xu ly nen.',
  })
  @ApiParam({ name: 'jobId', description: 'Ma job tu endpoint async' })
  @ApiResponse({ status: 200, description: 'Lay trang thai thanh cong' })
  async getOCRJobStatus(@Param('jobId') jobId: string) {
    const job = await this.ocrQueue.getJob(jobId);
    if (!job) {
      return BaseResponse.ok({ status: 'NOT_FOUND' }, 'Khong tim thay job');
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return BaseResponse.ok({
      status: state.toUpperCase(),
      result: state === 'completed' ? result : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
    });
  }

  // ----------------------------------------------------------------
  // Helper: Ghi audit log OCR (non-blocking, dung trong controller)
  // ----------------------------------------------------------------

  private async logOcrAudit(
    userId: string,
    mode: 'single' | 'batch',
    succeeded: number,
    total?: number,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'AI_OCR',
          entity: 'DocumentExtraction',
          newData: {
            mode,
            succeeded,
            total: total ?? succeeded,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Khong luu duoc audit log AI_OCR: ${err}`);
    }
  }
}
