import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { GrantConsentDto, ConsentResponseDto, ConsentAuditEntryDto } from './dto/consent.dto';

/**
 * Consent Management Service
 *
 * Implements consent tracking as required by NĐ 13/2023/NĐ-CP (Vietnamese Personal Data Protection Decree).
 *
 * Key compliance requirements addressed:
 * - Article 9:  Consent must be obtained before processing personal data
 * - Article 11: Purpose limitation — data processed only for consented purposes
 * - Article 12: Consent must be freely given, specific, informed, and unambiguous
 * - Article 13: Consent can be withdrawn at any time
 *
 * All consent actions are recorded with IP address and user agent for evidence.
 */
@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant or update consent for a specific purpose.
   * Records IP address and user agent for compliance evidence.
   *
   * @param userId - The user granting consent
   * @param dto - Consent details (type, granted status, policy version)
   * @param ipAddress - Client IP address for audit trail
   * @param userAgent - Client user agent for audit trail
   */
  async grantConsent(
    userId: string,
    dto: GrantConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ConsentResponseDto> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Upsert consent record
    const consent = await this.prisma.userConsent.upsert({
      where: {
        userId_consentType_version: {
          userId,
          consentType: dto.consentType,
          version: dto.version,
        },
      },
      create: {
        userId,
        consentType: dto.consentType,
        granted: dto.granted,
        grantedAt: dto.granted ? new Date() : null,
        revokedAt: dto.granted ? null : new Date(),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        version: dto.version,
      },
      update: {
        granted: dto.granted,
        grantedAt: dto.granted ? new Date() : undefined,
        revokedAt: dto.granted ? null : new Date(),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // Log consent action in audit trail
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: dto.granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        entity: 'UserConsent',
        entityId: consent.id,
        newData: {
          consentType: dto.consentType,
          granted: dto.granted,
          version: dto.version,
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString(),
        },
        ipAddress: ipAddress || null,
      },
    });

    this.logger.log(
      `User ${userId} ${dto.granted ? 'granted' : 'revoked'} consent for ${dto.consentType} (v${dto.version})`,
    );

    return consent as ConsentResponseDto;
  }

  /**
   * Revoke a specific consent type for a user.
   * NĐ 13/2023 Article 13 — Right to withdraw consent at any time.
   */
  async revokeConsent(
    userId: string,
    consentType: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Find the most recent active consent of this type
    const activeConsent = await this.prisma.userConsent.findFirst({
      where: {
        userId,
        consentType,
        granted: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeConsent) {
      throw new NotFoundException(
        `No active consent of type '${consentType}' found for user ${userId}`,
      );
    }

    await this.prisma.userConsent.update({
      where: { id: activeConsent.id },
      data: {
        granted: false,
        revokedAt: new Date(),
        ipAddress: ipAddress || activeConsent.ipAddress,
        userAgent: userAgent || activeConsent.userAgent,
      },
    });

    // Log revocation
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CONSENT_REVOKED',
        entity: 'UserConsent',
        entityId: activeConsent.id,
        oldData: {
          consentType,
          granted: true,
          version: activeConsent.version,
        },
        newData: {
          consentType,
          granted: false,
          revokedAt: new Date().toISOString(),
          ipAddress,
        },
        ipAddress: ipAddress || null,
      },
    });

    this.logger.log(`User ${userId} revoked consent for ${consentType}`);
  }

  /**
   * Get all current consents for a user.
   */
  async getUserConsents(userId: string): Promise<ConsentResponseDto[]> {
    const consents = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: [{ consentType: 'asc' }, { createdAt: 'desc' }],
    });

    return consents as ConsentResponseDto[];
  }

  /**
   * Check if a user has granted a specific consent type.
   * Used by other services to verify consent before processing data.
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const consent = await this.prisma.userConsent.findFirst({
      where: {
        userId,
        consentType,
        granted: true,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, granted: true },
    });

    return consent?.granted === true;
  }

  /**
   * Get the full consent audit trail for a user.
   * NĐ 13/2023 compliance — demonstrating consent history with timestamps,
   * IP addresses, and user agents as evidence.
   */
  async getConsentAuditTrail(userId: string): Promise<ConsentAuditEntryDto[]> {
    const consents = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return consents as ConsentAuditEntryDto[];
  }

  /**
   * Get consent summary — checks all consent types for a user.
   * Useful for displaying consent status on user profile/settings page.
   */
  async getConsentSummary(
    userId: string,
  ): Promise<Record<string, { granted: boolean; version: string | null; updatedAt: Date | null }>> {
    const consentTypes = ['data_processing', 'marketing', 'analytics', 'third_party_sharing'];

    const summary: Record<
      string,
      { granted: boolean; version: string | null; updatedAt: Date | null }
    > = {};

    for (const type of consentTypes) {
      const consent = await this.prisma.userConsent.findFirst({
        where: { userId, consentType: type },
        orderBy: { createdAt: 'desc' },
        select: { granted: true, version: true, updatedAt: true },
      });

      summary[type] = consent
        ? { granted: consent.granted, version: consent.version, updatedAt: consent.updatedAt }
        : { granted: false, version: null, updatedAt: null };
    }

    return summary;
  }
}
