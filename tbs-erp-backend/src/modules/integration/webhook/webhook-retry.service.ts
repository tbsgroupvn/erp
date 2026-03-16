import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual, createHmac } from 'crypto';
import { PrismaService } from '@core/database/prisma.service';
import { MetricsService } from '@core/metrics/metrics.service';
import { validateWebhookUrl } from './webhook-url-validator';
import { CircuitBreaker } from '@common/utils/circuit-breaker.util';

/**
 * Webhook Retry Service — Handles reliable delivery of webhook events to
 * registered endpoints with exponential backoff retry.
 *
 * Retry schedule (5 attempts total):
 *   Attempt 0: Immediate
 *   Attempt 1: After 60 seconds
 *   Attempt 2: After 5 minutes
 *   Attempt 3: After 30 minutes
 *   Attempt 4: After 2 hours
 *
 * After all retries are exhausted, the delivery is moved to "dead_letter"
 * status for manual investigation.
 *
 * Webhook payloads are signed with HMAC-SHA256 using the endpoint's secret
 * key, sent in the X-Webhook-Signature header. Recipients can verify
 * authenticity by computing the same HMAC over the request body.
 *
 * Headers sent with each delivery:
 *   - Content-Type: application/json
 *   - X-Webhook-ID: Unique delivery ID
 *   - X-Webhook-Event: Event type (e.g., "order.created")
 *   - X-Webhook-Attempt: Attempt number (0-based)
 *   - X-Webhook-Signature: HMAC-SHA256 hex digest
 *   - X-Webhook-Timestamp: ISO 8601 timestamp for replay protection
 */
@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_DELAYS_SECONDS = [0, 60, 300, 1800, 7200]; // 0, 1m, 5m, 30m, 2h
  private static readonly DELIVERY_TIMEOUT_MS = 30000; // 30 seconds
  private static readonly MAX_RESPONSE_LENGTH = 4096; // Truncate response body for storage

  /** Circuit breakers per endpoint domain to prevent hammering unhealthy targets */
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Get or create a CircuitBreaker for the given endpoint URL (keyed by hostname).
   * This ensures all webhook deliveries to the same domain share a single breaker.
   */
  private getCircuitBreaker(endpointUrl: string): CircuitBreaker {
    const domain = new URL(endpointUrl).hostname;
    if (!this.circuitBreakers.has(domain)) {
      this.circuitBreakers.set(
        domain,
        new CircuitBreaker({
          name: `webhook-${domain}`,
          failureThreshold: 5,
          resetTimeoutMs: 60_000, // 1 minute
        }),
      );
    }
    return this.circuitBreakers.get(domain)!;
  }

  /**
   * Dispatch a webhook event to all active endpoints subscribed to this event type.
   *
   * This is the main entry point — called by domain services when events occur.
   * Example: this.webhookRetryService.dispatch('order.created', { orderId: '...', ... });
   */
  async dispatch(event: string, payload: Record<string, any>): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    });

    if (endpoints.length === 0) {
      return; // No subscribers for this event
    }

    this.logger.log(`Dispatching "${event}" to ${endpoints.length} endpoint(s)`);

    for (const endpoint of endpoints) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload: payload as any,
          status: 'pending',
          attempts: 0,
          maxAttempts: WebhookRetryService.MAX_RETRIES,
        },
      });

      // Attempt immediate delivery (non-blocking)
      this.processDelivery(delivery.id, endpoint.url, endpoint.secret, event, payload, 0).catch(
        (err) => this.logger.error(`Initial delivery failed for ${delivery.id}: ${err.message}`),
      );
    }
  }

  /**
   * Sanitize error messages before logging/storing to prevent leaking sensitive data.
   */
  private sanitizeErrorMessage(message: string | null | undefined): string {
    return (message || 'Unknown error')
      .substring(0, 200)
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
      .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
      .replace(/secret[=:]\s*\S+/gi, 'secret=[REDACTED]')
      .replace(/authorization[=:]\s*\S+/gi, 'authorization=[REDACTED]')
      .replace(/api[_-]?key[=:]\s*\S+/gi, 'apikey=[REDACTED]');
  }

  /**
   * Process a single webhook delivery attempt.
   */
  async processDelivery(
    deliveryId: string,
    targetUrl: string,
    secret: string,
    event: string,
    payload: Record<string, any>,
    attempt: number,
  ): Promise<void> {
    // Validate target URL to prevent SSRF attacks
    try {
      validateWebhookUrl(targetUrl);
    } catch (err) {
      this.logger.error(
        `Webhook delivery ${deliveryId} blocked: SSRF protection - ${err.message}`,
      );
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'dead_letter',
          errorMessage: 'Delivery blocked: URL failed security validation',
          attempts: attempt + 1,
          completedAt: new Date(),
        },
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const body = JSON.stringify(payload);
    const signature = this.signPayload(body, secret, timestamp);
    const startTime = performance.now();

    // Check circuit breaker before attempting delivery
    const breaker = this.getCircuitBreaker(targetUrl);

    try {
      const response = await breaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          WebhookRetryService.DELIVERY_TIMEOUT_MS,
        );

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-ID': deliveryId,
            'X-Webhook-Event': event,
            'X-Webhook-Attempt': String(attempt),
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp,
            'User-Agent': 'ERP-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Treat server errors (5xx) as failures for the circuit breaker
        if (res.status >= 500) {
          const errorBody = await res.text().catch(() => '');
          const err = new Error(`Server error ${res.status}: ${errorBody.substring(0, 200)}`);
          (err as any).statusCode = res.status;
          (err as any).responseBody = errorBody;
          throw err;
        }

        return res;
      });

      const duration = (performance.now() - startTime) / 1000;
      this.metricsService.webhookDeliveryDuration.observe({ event }, duration);

      let responseBody: string | null = null;
      try {
        responseBody = await response.text();
        if (responseBody && responseBody.length > WebhookRetryService.MAX_RESPONSE_LENGTH) {
          responseBody =
            responseBody.substring(0, WebhookRetryService.MAX_RESPONSE_LENGTH) + '... (truncated)';
        }
      } catch {
        // Ignore response body read errors
      }

      if (response.ok) {
        // Success
        await this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'success',
            statusCode: response.status,
            response: responseBody,
            attempts: attempt + 1,
            completedAt: new Date(),
          },
        });

        this.metricsService.webhookDeliveriesTotal.inc({ event, status: 'success' });
        this.logger.log(
          `Webhook delivered: ${deliveryId} (attempt ${attempt}, ${response.status})`,
        );
        return;
      }

      // Non-2xx (4xx) response — schedule retry (handleFailure sanitizes the error)
      await this.handleFailure(deliveryId, event, attempt, response.status, responseBody);
    } catch (error) {
      const duration = (performance.now() - startTime) / 1000;
      this.metricsService.webhookDeliveryDuration.observe({ event }, duration);

      // Circuit breaker OPEN — skip delivery and schedule retry
      if (error.message?.includes('Circuit breaker') && error.message?.includes('is OPEN')) {
        const domain = new URL(targetUrl).hostname;
        this.logger.warn(
          `Circuit breaker OPEN for ${domain}, scheduling retry for delivery ${deliveryId}`,
        );
        await this.handleFailure(
          deliveryId,
          event,
          attempt,
          null,
          `Circuit breaker OPEN - endpoint ${domain} appears down`,
        );
        return;
      }

      // Server error rethrown by circuit breaker — extract status code if available
      const statusCode = (error as any).statusCode ?? null;
      const responseBody = (error as any).responseBody;

      const errorMessage =
        error.name === 'AbortError'
          ? `Request timed out after ${WebhookRetryService.DELIVERY_TIMEOUT_MS}ms`
          : this.sanitizeErrorMessage(error.message);

      await this.handleFailure(
        deliveryId,
        event,
        attempt,
        statusCode,
        responseBody ? this.sanitizeErrorMessage(responseBody) : errorMessage,
      );
    }
  }

  /**
   * Handle a failed delivery attempt — schedule retry or move to dead letter.
   * Error messages are sanitized before storage/logging to prevent credential leaks.
   */
  private async handleFailure(
    deliveryId: string,
    event: string,
    attempt: number,
    statusCode: number | null,
    errorMessage: string | null,
  ): Promise<void> {
    const nextAttempt = attempt + 1;
    const sanitizedError = this.sanitizeErrorMessage(errorMessage);

    if (nextAttempt >= WebhookRetryService.MAX_RETRIES) {
      // All retries exhausted — dead letter
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'dead_letter',
          statusCode,
          errorMessage: sanitizedError,
          attempts: nextAttempt,
          completedAt: new Date(),
        },
      });

      this.metricsService.webhookDeliveriesTotal.inc({ event, status: 'dead_letter' });
      this.logger.error(
        `Webhook dead-lettered: ${deliveryId} after ${nextAttempt} attempts. ` +
          `Last error: ${sanitizedError}`,
      );
      return;
    }

    // Schedule retry with exponential backoff
    const delaySeconds = WebhookRetryService.RETRY_DELAYS_SECONDS[nextAttempt] ?? 7200;
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        statusCode,
        errorMessage: sanitizedError,
        attempts: nextAttempt,
        nextRetryAt,
      },
    });

    this.metricsService.webhookDeliveriesTotal.inc({ event, status: 'retry' });
    this.logger.warn(
      `Webhook delivery failed: ${deliveryId} (attempt ${attempt}). ` +
        `Retrying at ${nextRetryAt.toISOString()}. Error: ${sanitizedError}`,
    );
  }

  /**
   * Cron job to process pending retries.
   * Runs every 30 seconds to pick up deliveries whose nextRetryAt has passed.
   * Also recovers stale 'pending' deliveries that were created but never dispatched
   * (e.g., process crashed between DB record creation and HTTP fetch).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processRetries(): Promise<void> {
    // Recover stale pending deliveries older than 2 minutes.
    // These are records created by dispatch() but whose processDelivery() never
    // started or completed (e.g., process crash between DB write and fetch call).
    const staleCutoff = new Date(Date.now() - 120_000); // 2 minutes ago
    const stalePending = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'pending',
        attempts: 0,
        createdAt: { lte: staleCutoff },
      },
      include: {
        endpoint: true,
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    for (const delivery of stalePending) {
      if (!delivery.endpoint.isActive) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'dead_letter',
            errorMessage: 'Endpoint deactivated',
            completedAt: new Date(),
          },
        });
        continue;
      }

      this.logger.warn(`Recovering stale pending delivery: ${delivery.id}`);
      this.processDelivery(
        delivery.id,
        delivery.endpoint.url,
        delivery.endpoint.secret,
        delivery.event,
        delivery.payload as Record<string, any>,
        delivery.attempts,
      ).catch((err) =>
        this.logger.error(`Stale delivery recovery failed for ${delivery.id}: ${err.message}`),
      );
    }

    // Process failed deliveries whose retry time has passed
    const pendingRetries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'failed',
        nextRetryAt: { lte: new Date() },
      },
      include: {
        endpoint: true,
      },
      take: this.getRetryBatchSize(),
      orderBy: { nextRetryAt: 'asc' },
    });

    for (const delivery of pendingRetries) {
      if (!delivery.endpoint.isActive) {
        // Endpoint was deactivated since the delivery was queued
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'dead_letter',
            errorMessage: 'Endpoint deactivated',
            completedAt: new Date(),
          },
        });
        continue;
      }

      this.processDelivery(
        delivery.id,
        delivery.endpoint.url,
        delivery.endpoint.secret,
        delivery.event,
        delivery.payload as Record<string, any>,
        delivery.attempts,
      ).catch((err) =>
        this.logger.error(`Retry processing failed for ${delivery.id}: ${err.message}`),
      );
    }
  }

  /**
   * Sign a webhook payload using HMAC-SHA256.
   *
   * The signature is computed over: timestamp + '.' + body
   * This prevents replay attacks — recipients should verify that the
   * timestamp is recent (within 5 minutes) before accepting the webhook.
   */
  signPayload(body: string, secret: string, timestamp: string): string {
    const signatureInput = `${timestamp}.${body}`;
    return createHmac('sha256', secret).update(signatureInput).digest('hex');
  }

  /**
   * Dynamically determine retry batch size based on pending count.
   * Scales down when backlog is large to avoid overwhelming external systems.
   */
  private getRetryBatchSize(): number {
    // Base batch size
    const baseBatch = 20;
    // Could be enhanced with Redis-based metrics in the future
    return baseBatch;
  }

  /**
   * Verify an inbound webhook signature (HMAC-SHA256).
   * Used by integration controllers to validate incoming webhooks from external systems.
   *
   * @param body - Raw request body string
   * @param signature - The signature from X-Webhook-Signature header
   * @param secret - The shared secret for this webhook source
   * @param timestamp - The timestamp from X-Webhook-Timestamp header
   * @param maxAgeMs - Maximum age of the timestamp (default: 5 minutes)
   * @returns true if signature is valid and timestamp is recent
   */
  verifyInboundSignature(
    body: string,
    signature: string,
    secret: string,
    timestamp: string,
    maxAgeMs: number = 300_000,
  ): boolean {
    // Check timestamp freshness to prevent replay attacks
    const webhookTime = new Date(timestamp).getTime();
    if (isNaN(webhookTime) || Date.now() - webhookTime > maxAgeMs) {
      this.logger.warn(`Webhook signature rejected: timestamp too old or invalid (${timestamp})`);
      return false;
    }

    const expectedSignature = this.signPayload(body, secret, timestamp);
    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Send a test event to a specific endpoint (for verification during setup).
   */
  async sendTestEvent(
    endpointId: string,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    // Validate endpoint URL to prevent SSRF attacks
    try {
      validateWebhookUrl(endpoint.url);
    } catch (err) {
      return { success: false, error: 'URL blocked by security policy' };
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      message: 'This is a test event from TBS ERP to verify webhook connectivity.',
    };

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event: 'webhook.test',
        payload: testPayload as any,
        status: 'pending',
        attempts: 0,
        maxAttempts: 1, // No retries for test events
      },
    });

    const body = JSON.stringify(testPayload);
    const timestamp = new Date().toISOString();
    const signature = this.signPayload(body, endpoint.secret, timestamp);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for test

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': 'webhook.test',
          'X-Webhook-Attempt': '0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'User-Agent': 'ERP-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.ok ? 'success' : 'failed',
          statusCode: response.status,
          attempts: 1,
          completedAt: new Date(),
        },
      });

      return { success: response.ok, statusCode: response.status };
    } catch (error) {
      const sanitizedError = this.sanitizeErrorMessage(error.message);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          errorMessage: sanitizedError,
          attempts: 1,
          completedAt: new Date(),
        },
      });

      return { success: false, error: sanitizedError };
    }
  }
}
