import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[];
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.fromEmail = config.get('SMTP_FROM_EMAIL', 'noreply@tbslogistics.com');
    this.fromName = config.get('SMTP_FROM_NAME', 'TBS Logistics');

    const host = config.get('SMTP_HOST', '');
    const port = config.get<number>('SMTP_PORT', 587);
    const user = config.get('SMTP_USER', '');
    const pass = config.get('SMTP_PASS', '');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured, email not sent');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc?.join(', '),
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (err) {
      this.logger.error('Failed to send email', err);
      throw err;
    }
  }

  // Pre-built templates
  async sendQuotationEmail(to: string, quotationCode: string, pdfBuffer?: Buffer) {
    await this.send({
      to,
      subject: `Báo giá ${quotationCode} từ TBS Logistics`,
      html: this.quotationTemplate(quotationCode),
      attachments: pdfBuffer
        ? [{ filename: `${quotationCode}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        : undefined,
    });
  }

  async sendInvoiceEmail(to: string, invoiceCode: string) {
    await this.send({
      to,
      subject: `Hóa đơn ${invoiceCode} từ TBS Logistics`,
      html: this.invoiceTemplate(invoiceCode),
    });
  }

  async sendWelcomeEmail(to: string, fullName: string, tempPassword: string) {
    await this.send({
      to,
      subject: 'Chào mừng đến với TBS Workplace',
      html: this.welcomeTemplate(fullName, tempPassword),
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string) {
    await this.send({
      to,
      subject: 'Đặt lại mật khẩu - TBS Workplace',
      html: this.passwordResetTemplate(resetToken, resetUrl),
    });
  }

  // ─── Templates ───
  private baseTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .wrapper { max-width: 600px; margin: 24px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1d4ed8; color: white; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { padding: 24px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e5e7eb; }
        .btn { display: inline-block; padding: 10px 20px; background: #1d4ed8; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
      </style>
      </head><body>
      <div class="wrapper">
        <div class="header"><h1>TBS Logistics</h1></div>
        <div class="content">${content}</div>
        <div class="footer">
          TBS Group | <a href="https://app.tbslogistics.com">app.tbslogistics.com</a><br>
          Email này được gửi tự động, vui lòng không trả lời.
        </div>
      </div></body></html>
    `;
  }

  private quotationTemplate(code: string): string {
    return this.baseTemplate(`
      <h2>Báo giá ${code}</h2>
      <p>Kính gửi Quý khách,</p>
      <p>Vui lòng xem chi tiết báo giá đính kèm.</p>
      <p><a class="btn" href="https://app.tbslogistics.com/bao-gia">Xem online</a></p>
    `);
  }

  private invoiceTemplate(code: string): string {
    return this.baseTemplate(`
      <h2>Hóa đơn ${code}</h2>
      <p>Vui lòng thanh toán theo thông tin trong hóa đơn đính kèm.</p>
    `);
  }

  private welcomeTemplate(name: string, password: string): string {
    return this.baseTemplate(`
      <h2>Chào mừng ${name}!</h2>
      <p>Tài khoản của bạn đã được tạo trên TBS Workplace.</p>
      <p><strong>Mật khẩu tạm thời:</strong> <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;">${password}</code></p>
      <p>Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>
      <p><a class="btn" href="https://app.tbslogistics.com/login">Đăng nhập ngay</a></p>
    `);
  }

  private passwordResetTemplate(token: string, url: string): string {
    return this.baseTemplate(`
      <h2>Đặt lại mật khẩu</h2>
      <p>Nhấn vào nút bên dưới để đặt lại mật khẩu (có hiệu lực trong 1 giờ):</p>
      <p><a class="btn" href="${url}">Đặt lại mật khẩu</a></p>
      <p style="color:#888;font-size:12px;">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    `);
  }
}
