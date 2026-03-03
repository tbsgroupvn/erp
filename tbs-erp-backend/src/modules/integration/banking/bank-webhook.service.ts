import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '../../crm/domain/wallet.service';
import { BankWebhookPayloadDto } from './dto/bank-webhook-payload.dto';

@Injectable()
export class BankWebhookService {
  private readonly logger = new Logger(BankWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verify HMAC-SHA256 signature from bank webhook.
   */
  verifySignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('BANK_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.warn('BANK_WEBHOOK_SECRET not configured');
      return false;
    }
    if (!signature) return false;

    try {
      const computed = createHmac('sha256', secret).update(payload).digest('hex');
      return timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  /**
   * Parse customer code from bank transfer description.
   * Expected syntax: "NAP TBS-KH-000001" (case-insensitive).
   */
  parseCustomerCode(description: string): string | null {
    const match = description.match(/NAP\s+(TBS-KH-\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Core handler: receive bank transaction, parse, match customer, auto credit wallet.
   */
  async handleWebhook(
    provider: string,
    payload: BankWebhookPayloadDto,
  ): Promise<{ status: string; message: string; transactionId?: string }> {
    this.logger.log(
      `Bank webhook received: provider=${provider}, traceId=${payload.traceId}, amount=${payload.amount}`,
    );

    // 1. Check duplicate bankTraceId
    const existing = await this.prisma.bankWebhookTransaction.findUnique({
      where: { bankTraceId: payload.traceId },
    });
    if (existing) {
      this.logger.warn(`Duplicate webhook: traceId=${payload.traceId}`);
      return { status: 'DUPLICATE', message: 'Giao dich da duoc xu ly truoc do' };
    }

    // 2. Parse customer code from description
    const customerCode = this.parseCustomerCode(payload.description);

    // 3. Create BankWebhookTransaction record (status=PENDING)
    const bwt = await this.prisma.bankWebhookTransaction.create({
      data: {
        provider,
        bankTraceId: payload.traceId,
        amount: new Prisma.Decimal(payload.amount),
        description: payload.description,
        bankCode: payload.bankCode ?? null,
        accountNumber: payload.accountNumber ?? null,
        transactionDate: new Date(payload.transactionDate),
        parsedCustomerCode: customerCode,
        rawPayload: payload as any,
        status: 'PENDING',
      },
    });

    // 4. If customer code not parseable -> FAILED
    if (!customerCode) {
      await this.prisma.bankWebhookTransaction.update({
        where: { id: bwt.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Khong parse duoc ma KH tu noi dung CK. Cu phap: NAP TBS-KH-XXXXXX',
          processedAt: new Date(),
        },
      });
      this.logger.warn(`Webhook FAILED: cannot parse customer code from "${payload.description}"`);
      return { status: 'FAILED', message: 'Cu phap khong hop le. Yeu cau: NAP TBS-KH-XXXXXX' };
    }

    // 5. Lookup customer by code
    const customer = await this.prisma.customer.findFirst({
      where: { code: customerCode },
      select: { id: true, code: true, fullName: true },
    });
    if (!customer) {
      await this.prisma.bankWebhookTransaction.update({
        where: { id: bwt.id },
        data: {
          status: 'FAILED',
          errorMessage: `Khong tim thay khach hang voi ma: ${customerCode}`,
          processedAt: new Date(),
        },
      });
      this.logger.warn(`Webhook FAILED: customer not found for code=${customerCode}`);
      return { status: 'FAILED', message: `Khong tim thay khach hang ${customerCode}` };
    }

    // 6. Auto credit wallet
    try {
      const result = await this.walletService.topup(
        customer.id,
        Number(payload.amount),
        `BANK-WEBHOOK:${payload.traceId}`,
        `Tu dong nap vi tu ${provider}: ${payload.description}`,
        payload.traceId,
      );

      await this.prisma.bankWebhookTransaction.update({
        where: { id: bwt.id },
        data: {
          status: 'AUTO_CREDITED',
          matchedCustomerId: customer.id,
          walletTransactionId: result.transaction.id,
          processedAt: new Date(),
        },
      });

      // 7. Emit event for notification
      this.eventEmitter.emit('wallet.auto.topup', {
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.fullName,
        amount: Number(payload.amount),
        bankTraceId: payload.traceId,
        provider,
      });

      this.logger.log(
        `Webhook AUTO_CREDITED: customer=${customer.code}, amount=${payload.amount}, traceId=${payload.traceId}`,
      );

      return {
        status: 'AUTO_CREDITED',
        message: 'Nap vi thanh cong',
        transactionId: result.transaction.id,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.prisma.bankWebhookTransaction.update({
        where: { id: bwt.id },
        data: {
          status: 'FAILED',
          errorMessage: errorMsg,
          processedAt: new Date(),
        },
      });
      this.logger.error(`Webhook FAILED: ${errorMsg}`, error instanceof Error ? error.stack : '');
      return { status: 'FAILED', message: errorMsg };
    }
  }

  /**
   * List webhook transactions for admin dashboard.
   */
  async listTransactions(params?: { status?: string; page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BankWebhookTransactionWhereInput = {};
    if (params?.status) {
      where.status = params.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.bankWebhookTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.bankWebhookTransaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
