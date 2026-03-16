import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Standard document types that are always required for every customs declaration.
 */
const ALWAYS_REQUIRED_DOCUMENTS = ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING'] as const;

/**
 * Cargo-type-specific documents that are conditionally required.
 * Key = cargo type keyword, value = additional document types.
 */
const CARGO_SPECIFIC_DOCUMENTS: Record<string, string[]> = {
  FOOD: ['INSPECTION_CERT', 'C/O'],
  AGRICULTURAL: ['INSPECTION_CERT', 'C/O'],
  CHEMICAL: ['INSPECTION_CERT'],
  PHARMACEUTICAL: ['INSPECTION_CERT', 'C/O'],
  ELECTRONICS: ['C/O'],
  TEXTILE: ['C/O'],
};

/**
 * XNK-2: Customs Document Checklist Service.
 *
 * Manages the lifecycle of required customs documents per declaration:
 *  - Auto-generate checklist items based on cargo type
 *  - Track upload and verification status
 *  - Daily cron to detect documents nearing expiry
 */
@Injectable()
export class CustomsDocumentService {
  private readonly logger = new Logger(CustomsDocumentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Auto-generates the document checklist for a customs declaration.
   *
   * Standard documents (Commercial Invoice, Packing List, B/L) are always
   * created. Additional documents (C/O, Inspection Certificate) are added
   * based on the cargo type derived from the declaration's lines.
   *
   * Existing checklist items are preserved (not duplicated).
   */
  async generateChecklist(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: {
          where: { deletedAt: null },
          select: { declaredDescription: true },
        },
        documentChecklists: {
          select: { documentType: true },
        },
      },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    // Determine which document types already exist
    const existingTypes = new Set(declaration.documentChecklists.map((dc) => dc.documentType));

    // Always-required documents
    const requiredTypes: Set<string> = new Set([...ALWAYS_REQUIRED_DOCUMENTS]);

    // Detect cargo-specific documents from line descriptions
    const allDescriptions = declaration.lines
      .map((l) => l.declaredDescription.toUpperCase())
      .join(' ');

    for (const [cargoKeyword, docTypes] of Object.entries(CARGO_SPECIFIC_DOCUMENTS)) {
      if (allDescriptions.includes(cargoKeyword)) {
        for (const docType of docTypes) {
          requiredTypes.add(docType);
        }
      }
    }

    // Also check shipping method: AIR uses AWB instead of B/L but we
    // keep BILL_OF_LADING as a generic transport document label.

    // Create checklist items for types that don't already exist
    const newItems: Array<{
      declarationId: string;
      documentType: string;
      isRequired: boolean;
      status: string;
    }> = [];

    for (const docType of requiredTypes) {
      if (!existingTypes.has(docType)) {
        newItems.push({
          declarationId,
          documentType: docType,
          isRequired: true,
          status: 'MISSING',
        });
      }
    }

    if (newItems.length > 0) {
      await this.prisma.customsDocumentChecklist.createMany({
        data: newItems,
      });
    }

    this.logger.log(
      `Document checklist generated for declaration ${declaration.code}: ${newItems.length} new item(s), ${existingTypes.size} existing`,
    );

    // Return the full updated checklist
    return this.getChecklist(declarationId);
  }

  /**
   * Returns all checklist items for a given declaration.
   */
  async getChecklist(declarationId: string) {
    const declaration = await this.prisma.customsDeclaration.findUnique({
      where: { id: declarationId },
      select: { id: true, code: true },
    });

    if (!declaration) {
      throw new NotFoundException(`Customs declaration with ID ${declarationId} not found`);
    }

    const items = await this.prisma.customsDocumentChecklist.findMany({
      where: { declarationId },
      orderBy: { createdAt: 'asc' },
    });

    const summary = {
      total: items.length,
      missing: items.filter((i) => i.status === 'MISSING').length,
      uploaded: items.filter((i) => i.status === 'UPLOADED').length,
      verified: items.filter((i) => i.status === 'VERIFIED').length,
      expired: items.filter((i) => i.status === 'EXPIRED').length,
      isComplete: items.every(
        (i) => !i.isRequired || i.status === 'VERIFIED' || i.status === 'UPLOADED',
      ),
    };

    return {
      declarationId,
      declarationCode: declaration.code,
      items,
      summary,
    };
  }

  /**
   * Records a document upload for a checklist item.
   * Sets the item status to UPLOADED and stores the URL.
   */
  async uploadDocument(checklistItemId: string, documentUrl: string, uploadedBy: string) {
    const item = await this.prisma.customsDocumentChecklist.findUnique({
      where: { id: checklistItemId },
    });

    if (!item) {
      throw new NotFoundException(`Checklist item with ID ${checklistItemId} not found`);
    }

    if (!documentUrl || documentUrl.trim().length === 0) {
      throw new BadRequestException('Document URL must not be empty');
    }

    const updated = await this.prisma.customsDocumentChecklist.update({
      where: { id: checklistItemId },
      data: {
        documentUrl,
        uploadedAt: new Date(),
        uploadedBy,
        status: 'UPLOADED',
      },
    });

    this.logger.log(
      `Document uploaded for checklist item ${checklistItemId} (${item.documentType}) by ${uploadedBy}`,
    );

    return updated;
  }

  /**
   * Marks a checklist item as VERIFIED after manual review.
   */
  async verifyDocument(checklistItemId: string) {
    const item = await this.prisma.customsDocumentChecklist.findUnique({
      where: { id: checklistItemId },
    });

    if (!item) {
      throw new NotFoundException(`Checklist item with ID ${checklistItemId} not found`);
    }

    if (item.status !== 'UPLOADED') {
      throw new BadRequestException(
        `Cannot verify item in ${item.status} status. Only UPLOADED items can be verified.`,
      );
    }

    const updated = await this.prisma.customsDocumentChecklist.update({
      where: { id: checklistItemId },
      data: {
        status: 'VERIFIED',
      },
    });

    this.logger.log(`Document verified: checklist item ${checklistItemId} (${item.documentType})`);

    return updated;
  }

  /**
   * Daily cron job that checks for documents expiring within the next 30 days.
   *
   * Items with an `expiryDate` that falls within now + 30 days are flagged
   * as EXPIRED (if already past) or logged as a warning (if approaching).
   * In a production environment, this would also trigger notifications to
   * the customs team.
   *
   * Runs every day at 8:00 AM.
   */
  @Cron('0 8 * * *')
  async checkExpiry(): Promise<void> {
    this.logger.log('Starting customs document expiry check...');

    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Find items with expiry date within the next 30 days
      const expiringItems = await this.prisma.customsDocumentChecklist.findMany({
        where: {
          expiryDate: {
            not: null,
            lte: thirtyDaysFromNow,
          },
          status: { not: 'EXPIRED' },
        },
        include: {
          declaration: {
            select: { id: true, code: true, createdBy: true },
          },
        },
      });

      if (expiringItems.length === 0) {
        this.logger.debug('No expiring documents found');
        return;
      }

      let expiredCount = 0;
      let warningCount = 0;

      for (const item of expiringItems) {
        if (item.expiryDate! <= now) {
          // Already expired — update status
          await this.prisma.customsDocumentChecklist.update({
            where: { id: item.id },
            data: { status: 'EXPIRED' },
          });
          expiredCount++;

          this.logger.warn(
            `Document EXPIRED: ${item.documentType} for declaration ${item.declaration.code} (expired ${item.expiryDate!.toISOString().slice(0, 10)})`,
          );
        } else {
          // Approaching expiry — log warning
          const daysUntilExpiry = Math.ceil(
            (item.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          warningCount++;

          this.logger.warn(
            `Document expiring in ${daysUntilExpiry} day(s): ${item.documentType} for declaration ${item.declaration.code}`,
          );
        }

        // TODO: Send notification to customs team via NotificationService
        // await this.notificationService.send({
        //   userId: item.declaration.createdBy,
        //   title: `Document expiry: ${item.documentType}`,
        //   body: `Document ${item.documentType} for declaration ${item.declaration.code} is expiring.`,
        //   type: 'CUSTOMS',
        //   referenceId: item.declarationId,
        // });
      }

      this.logger.log(
        `Document expiry check completed: ${expiredCount} expired, ${warningCount} warning(s)`,
      );
    } catch (error) {
      this.logger.error(`Document expiry check failed: ${error.message}`, error.stack);
    }
  }
}
