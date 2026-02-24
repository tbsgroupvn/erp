import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Layer 4C: Barcode validation service for warehouse CN operations.
 *
 * Validates barcode format, checks for duplicates, and cross-references
 * with tracking numbers.
 */
@Injectable()
export class BarcodeValidatorService {
  private readonly logger = new Logger(BarcodeValidatorService.name);

  /** Common CN tracking number patterns (SF Express, YTO, ZTO, STO, etc.) */
  private readonly BARCODE_PATTERNS = [
    /^SF\d{12,15}$/i,        // SF Express
    /^YT\d{13,18}$/i,        // YTO Express
    /^7[0-9]{12,14}$/,       // ZTO Express
    /^5[0-9]{12,14}$/,       // STO Express
    /^JD\d{10,15}$/i,        // JD Logistics
    /^[A-Z]{2}\d{6,20}$/i,   // Generic CN tracking
    /^\d{10,20}$/,            // Numeric-only barcodes
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a barcode/tracking number format.
   * Returns true if the barcode matches any known pattern.
   */
  validateFormat(barcode: string): { valid: boolean; message?: string } {
    if (!barcode || barcode.trim().length < 3) {
      return { valid: false, message: 'Mã vạch phải có ít nhất 3 ký tự' };
    }

    const trimmed = barcode.trim();

    // Check against known patterns
    const matchesPattern = this.BARCODE_PATTERNS.some((pattern) =>
      pattern.test(trimmed),
    );

    if (!matchesPattern) {
      this.logger.warn(
        `Barcode format warning: ${trimmed} does not match known CN tracking patterns`,
      );
      // Warn but don't block — some carriers use non-standard formats
      return { valid: true, message: 'Mã vạch không khớp định dạng phổ biến' };
    }

    return { valid: true };
  }

  /**
   * Checks if a barcode/tracking number is already used by another package.
   */
  async checkDuplicate(
    barcode: string,
    excludePackageId?: string,
  ): Promise<{ isDuplicate: boolean; existingPackageCode?: string }> {
    const existing = await this.prisma.package.findFirst({
      where: {
        trackingNumberCN: { equals: barcode.trim(), mode: 'insensitive' },
        ...(excludePackageId ? { id: { not: excludePackageId } } : {}),
      },
      select: { id: true, code: true },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingPackageCode: existing.code,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Full validation: format check + duplicate check.
   * Throws on failure.
   */
  async validate(
    barcode: string,
    excludePackageId?: string,
  ): Promise<void> {
    // Format validation
    const formatResult = this.validateFormat(barcode);
    if (!formatResult.valid) {
      throw new BadRequestException(formatResult.message);
    }

    // Duplicate check
    const duplicateResult = await this.checkDuplicate(
      barcode,
      excludePackageId,
    );
    if (duplicateResult.isDuplicate) {
      throw new ConflictException(
        `Mã vạch ${barcode} đã tồn tại trên kiện ${duplicateResult.existingPackageCode}`,
      );
    }
  }
}
