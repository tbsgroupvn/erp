import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { BankWebhookService } from './bank-webhook.service';
import { BankWebhookPayloadDto } from './dto/bank-webhook-payload.dto';

@ApiTags('Integration - Bank Webhook')
@Controller('integrations/banking')
export class BankWebhookController {
  private readonly logger = new Logger(BankWebhookController.name);

  constructor(private readonly bankWebhookService: BankWebhookService) {}

  /**
   * PUBLIC endpoint - authenticated via HMAC signature, NOT JWT.
   * Bank/3rd-party (Casso, PayOS) sends transaction notifications here.
   * Always returns 200 OK to prevent bank retries.
   */
  @Post('webhook/:provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive bank webhook notification (public, HMAC-authenticated)',
    description: 'Receives bank transaction webhooks from providers like Casso, PayOS. ' +
      'Verifies HMAC-SHA256 signature, parses customer code from description, ' +
      'and auto-credits the wallet.',
  })
  @ApiParam({ name: 'provider', description: 'Webhook provider (casso, payos, manual)', example: 'casso' })
  async handleBankWebhook(
    @Param('provider') provider: string,
    @Body() payload: BankWebhookPayloadDto,
    @Headers('x-webhook-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Verify HMAC signature
    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(payload);
    if (!this.bankWebhookService.verifySignature(rawBody, signature)) {
      this.logger.warn(`Invalid webhook signature from provider=${provider}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const result = await this.bankWebhookService.handleWebhook(provider, payload);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Admin endpoint - view webhook transaction history.
   * Requires JWT + appropriate role.
   */
  @Get('webhook-transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('CEO', 'CFO', 'CHIEF_ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'List bank webhook transactions (admin)',
    description: 'Returns paginated list of bank webhook transactions with processing status.',
  })
  async listWebhookTransactions(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.bankWebhookService.listTransactions({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return BaseResponse.ok(result);
  }
}
