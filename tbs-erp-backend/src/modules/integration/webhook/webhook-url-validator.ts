import { BadRequestException } from '@nestjs/common';

/**
 * Validates a webhook URL to prevent SSRF (Server-Side Request Forgery) attacks.
 *
 * Blocks:
 * - Localhost and loopback addresses
 * - Private/internal IP ranges (RFC 1918, link-local, IPv6 private)
 * - Cloud metadata endpoints (AWS, GCP)
 * - Non-HTTP(S) protocols
 *
 * @throws BadRequestException if the URL is invalid or points to a blocked target
 */
export function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid webhook URL format');
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Webhook URL must use HTTP or HTTPS protocol');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and loopback
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]'
  ) {
    throw new BadRequestException('Webhook URL cannot point to localhost');
  }

  // Block private IP ranges (RFC 1918 + link-local)
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // Link-local
    /^127\./, // Loopback range
    /^0\./, // 0.0.0.0/8
    /^fc00:/i, // IPv6 unique local
    /^fd/i, // IPv6 unique local
    /^fe80:/i, // IPv6 link-local
  ];

  for (const range of privateRanges) {
    if (range.test(hostname)) {
      throw new BadRequestException(
        'Webhook URL cannot point to private/internal networks',
      );
    }
  }

  // Block common cloud metadata endpoints
  if (
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata.internal'
  ) {
    throw new BadRequestException(
      'Webhook URL cannot point to cloud metadata services',
    );
  }
}
