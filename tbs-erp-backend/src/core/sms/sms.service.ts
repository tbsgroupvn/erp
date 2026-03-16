import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '@common/utils/retry.util';

/**
 * Supported SMS provider types.
 */
export type SmsProvider = 'speedsms' | 'twilio' | 'mock';

/**
 * Generic SMS service that supports multiple providers:
 * - SpeedSMS (Vietnamese provider — default for VN deployments)
 * - Twilio (international fallback)
 * - Mock (development / testing — logs to console)
 *
 * Configuration via environment variables:
 *   SMS_PROVIDER   = 'speedsms' | 'twilio' | 'mock'
 *   SMS_API_KEY    = provider API key or auth token
 *   SMS_SENDER     = sender name or number
 *   SMS_TWILIO_SID = Twilio Account SID (only when SMS_PROVIDER=twilio)
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;
  private readonly apiKey: string;
  private readonly sender: string;
  private readonly twilioSid: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('SMS_PROVIDER', 'mock') as SmsProvider;
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    this.sender =
      this.configService.get<string>('SMS_SENDER', '') ||
      this.configService.get<string>('branding.companyName', 'ERP');
    this.twilioSid = this.configService.get<string>('SMS_TWILIO_SID', '');
  }

  /**
   * Send an SMS message to the given phone number.
   * External provider calls are wrapped with retry logic (3 retries, exponential backoff).
   * Returns true on success, false on failure (never throws).
   */
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      switch (this.provider) {
        case 'speedsms':
          return await withRetry(
            () => this.sendViaSpeedSms(phoneNumber, message),
            { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10_000 },
            this.logger,
          );
        case 'twilio':
          return await withRetry(
            () => this.sendViaTwilio(phoneNumber, message),
            { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10_000 },
            this.logger,
          );
        case 'mock':
        default:
          return this.sendViaMock(phoneNumber, message);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phoneNumber.substring(0, 5)}***: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // SpeedSMS (Vietnamese provider)
  // API docs: https://speedsms.vn/sms-api-doc
  // ---------------------------------------------------------------------------
  private async sendViaSpeedSms(phoneNumber: string, message: string): Promise<boolean> {
    const url = 'https://api.speedsms.vn/index.php/sms/send';

    const body = JSON.stringify({
      to: [phoneNumber],
      content: message,
      sms_type: 2, // Customer care type
      sender: this.sender,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:x`).toString('base64')}`,
      },
      body,
    });

    const data = await response.json();

    if (data.status === 'success' || data.code === '00') {
      this.logger.log(`SpeedSMS sent to ${phoneNumber.substring(0, 5)}***`);
      return true;
    }

    this.logger.warn(`SpeedSMS error: ${JSON.stringify(data)}`);
    return false;
  }

  // ---------------------------------------------------------------------------
  // Twilio (international fallback)
  // ---------------------------------------------------------------------------
  private async sendViaTwilio(phoneNumber: string, message: string): Promise<boolean> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', phoneNumber);
    params.append('From', this.sender);
    params.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.twilioSid}:${this.apiKey}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (data.sid) {
      this.logger.log(`Twilio SMS sent to ${phoneNumber.substring(0, 5)}*** — SID: ${data.sid}`);
      return true;
    }

    this.logger.warn(`Twilio error: ${JSON.stringify(data)}`);
    return false;
  }

  // ---------------------------------------------------------------------------
  // Mock provider (development / testing)
  // ---------------------------------------------------------------------------
  private sendViaMock(phoneNumber: string, message: string): boolean {
    this.logger.log(`[MOCK SMS] To: ${phoneNumber} | Message: ${message}`);
    return true;
  }
}
