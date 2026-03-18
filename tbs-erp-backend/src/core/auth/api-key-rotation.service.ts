import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';
import { DomainException, ErrorCode } from '@common/exceptions';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyRotationService {
  private readonly logger = new Logger(ApiKeyRotationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new API key with prefix for identification.
   * Returns the raw key (to show the user once) and its SHA-256 hash (to store).
   */
  generateApiKey(prefix = 'tbs'): { key: string; hash: string; shortPrefix: string } {
    const rawKey = crypto.randomBytes(32).toString('base64url');
    const key = `${prefix}_${rawKey}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const shortPrefix = key.substring(0, 8);
    return { key, hash, shortPrefix };
  }

  /**
   * Rotate an API key - creates new key and marks old one for grace period.
   * The old key continues to work for 24 hours after rotation.
   */
  async rotateKey(keyId: string): Promise<{ newKey: string; expiresAt: Date }> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!existing) {
      throw new DomainException(ErrorCode.API_KEY_NOT_FOUND, `API key ${keyId} not found`, HttpStatus.NOT_FOUND);
    }

    if (!existing.isActive) {
      throw new DomainException(ErrorCode.API_KEY_NOT_FOUND, `API key ${keyId} is already inactive`, HttpStatus.BAD_REQUEST);
    }

    const { key: newKey, hash: newHash, shortPrefix } = this.generateApiKey();

    // Grace period: old key works for 24 hours after rotation
    const gracePeriodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      // Update old key with grace period expiry
      this.prisma.apiKey.update({
        where: { id: keyId },
        data: { expiresAt: gracePeriodEnd },
      }),
      // Create new key
      this.prisma.apiKey.create({
        data: {
          name: `${existing.name} (rotated)`,
          key: newHash,
          prefix: shortPrefix,
          permissions: existing.permissions ?? [],
          rateLimit: existing.rateLimit,
          isActive: true,
          createdBy: existing.createdBy,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      }),
    ]);

    this.logger.log(`API key ${keyId} rotated. Old key expires at ${gracePeriodEnd.toISOString()}`);

    return { newKey, expiresAt: gracePeriodEnd };
  }

  /**
   * Scheduled job: Clean up expired API keys and warn about keys expiring soon.
   * Runs daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredKeys(): Promise<void> {
    const now = new Date();

    // Deactivate and delete expired keys
    const deleted = await this.prisma.apiKey.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} expired API keys`);
    }

    // Warn about keys expiring within 7 days
    const soonExpiring = await this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gt: now,
          lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, name: true, expiresAt: true, createdBy: true },
    });

    for (const key of soonExpiring) {
      this.logger.warn(
        `API key "${key.name}" (${key.id}) expires at ${key.expiresAt?.toISOString()}`,
      );
    }
  }

  /**
   * Scheduled job: Auto-rotate keys older than 90 days.
   * Runs weekly. Only rotates active keys that have no explicit expiry set.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async autoRotateOldKeys(): Promise<void> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const oldKeys = await this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        createdAt: { lt: ninetyDaysAgo },
        expiresAt: null, // Only rotate keys without explicit expiry
      },
      select: { id: true, name: true },
    });

    for (const key of oldKeys) {
      try {
        await this.rotateKey(key.id);
        this.logger.log(`Auto-rotated old API key: ${key.name} (${key.id})`);
      } catch (error) {
        this.logger.error(`Failed to auto-rotate key ${key.id}: ${(error as Error).message}`);
      }
    }
  }
}
