import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EmailService } from '@core/email/email.service';
import { SendEmailDto, SendQuotationEmailDto, SendInvoiceEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailComposeService {
  private readonly logger = new Logger(EmailComposeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async sendCustomEmail(dto: SendEmailDto): Promise<void> {
    await this.emailService.send({
      to: dto.to,
      subject: dto.subject,
      html: dto.body,
      cc: dto.cc,
    });
  }

  async sendQuotationEmail(quotationId: string, dto: SendQuotationEmailDto): Promise<void> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { code: true, id: true },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    await this.emailService.sendQuotationEmail(dto.to, quotation.code);
    this.logger.log(`Quotation email sent for ${quotation.code} to ${dto.to}`);
  }

  async sendInvoiceEmail(invoiceId: string, dto: SendInvoiceEmailDto): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { code: true, id: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    await this.emailService.sendInvoiceEmail(dto.to, invoice.code);
    this.logger.log(`Invoice email sent for ${invoice.code} to ${dto.to}`);
  }
}
