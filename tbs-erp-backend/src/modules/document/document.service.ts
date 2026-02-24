import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { DocumentEntityType, Prisma } from '@prisma/client';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Uploads a document (stores metadata).
   */
  async upload(userId: string, dto: UploadDocumentDto) {
    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        entityType: dto.entityType as DocumentEntityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: dto.storageKey,
        tags: dto.tags || [],
        uploadedBy: userId,
        version: 1,
      },
    });

    this.logger.log(`Document uploaded: ${dto.name} for ${dto.entityType}/${dto.entityId}`);
    return document;
  }

  /**
   * Lists documents with pagination and filters.
   */
  async findAll(query: DocumentQueryDto) {
    const where: Prisma.DocumentWhereInput = { isDeleted: false };

    if (query.entityType) where.entityType = query.entityType as DocumentEntityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.DocumentOrderByWithRelationInput,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets document detail by ID.
   */
  async findById(id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  /**
   * Gets documents by entity type and ID.
   */
  async getByEntity(entityType: string, entityId: string) {
    return this.prisma.document.findMany({
      where: { entityType: entityType as DocumentEntityType, entityId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Generates a download URL (stub for S3 presigned URL).
   * Only serves non-deleted documents (findById filters isDeleted: false).
   */
  async getDownloadUrl(id: string) {
    // findById already ensures the document is not soft-deleted
    const document = await this.findById(id);

    // In production, this would generate an S3 presigned URL
    const downloadUrl = `https://storage.tbs-erp.vn/download/${document.storageKey}?expires=3600`;

    return {
      id: document.id,
      name: document.name,
      fileName: document.fileName,
      mimeType: document.mimeType,
      downloadUrl,
    };
  }

  /**
   * Soft deletes a document and schedules file cleanup.
   *
   * The 'document.deleted' event is emitted for downstream listeners to handle
   * actual storage cleanup (e.g., S3 object deletion). A background job should
   * periodically scan for soft-deleted documents older than a retention period
   * and purge their storage objects.
   *
   * TODO: Implement background job (e.g., cron) to purge storage objects for
   * documents that have been soft-deleted for longer than the retention period
   * (e.g., 30 days). Until then, the event listener handles immediate cleanup.
   */
  async delete(id: string, userId: string) {
    const document = await this.findById(id);

    await this.prisma.document.update({
      where: { id },
      data: {
        isDeleted: true,
        // deletedAt: new Date(), // Field likely doesn't exist in schema, relying on isDeleted
      },
    });

    // Emit event for storage cleanup listeners
    this.eventEmitter.emit('document.deleted', {
      documentId: document.id,
      storageKey: document.storageKey,
      deletedBy: userId,
    });

    this.logger.log(`Document ${document.name} soft-deleted by ${userId}`);
    return { deleted: true };
  }

  /**
   * Gets all documents related to an order, grouped by category.
   *
   * Collects documents linked to:
   * - The order itself (entityType=ORDER)
   * - Its packages (entityType=PACKAGE)
   * - Its container (entityType=CONTAINER)
   * - Its customer (entityType=CUSTOMER)
   *
   * Returns documents grouped by category (CONTRACT, INVOICE, CUSTOMS, POD, PHOTO, OTHER).
   */
  async getOrderDocuments(orderId: string) {
    // Fetch order with related entity IDs
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        customerId: true,
        containerId: true,
        packages: { select: { id: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const packageIds = order.packages.map((p) => p.id);

    // Build OR conditions for all related entities
    const orConditions: any[] = [
      { entityType: 'ORDER' as DocumentEntityType, entityId: orderId },
    ];

    if (packageIds.length > 0) {
      orConditions.push({
        entityType: 'PACKAGE' as DocumentEntityType,
        entityId: { in: packageIds },
      });
    }

    if (order.containerId) {
      orConditions.push({
        entityType: 'CONTAINER' as DocumentEntityType,
        entityId: order.containerId,
      });
    }

    if (order.customerId) {
      orConditions.push({
        entityType: 'CUSTOMER' as DocumentEntityType,
        entityId: order.customerId,
      });
    }

    const documents = await this.prisma.document.findMany({
      where: {
        isDeleted: false,
        OR: orConditions,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group documents by category
    const grouped: Record<string, typeof documents> = {
      CONTRACT: [],
      INVOICE: [],
      CUSTOMS: [],
      POD: [],
      PHOTO: [],
      OTHER: [],
    };

    for (const doc of documents) {
      const category = doc.category in grouped ? doc.category : 'OTHER';
      grouped[category].push(doc);
    }

    this.logger.log(
      `Order document hub for ${order.code}: ${documents.length} documents found`,
    );

    return {
      orderId,
      orderCode: order.code,
      totalDocuments: documents.length,
      grouped,
    };
  }

  /**
   * Adds a new version of a document.
   */
  async addVersion(id: string, dto: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    uploadedBy: string;
  }) {
    const document = await this.findById(id);

    // Preserve current version info before overwriting
    const versionEntry = {
      version: document.version,
      fileName: document.fileName,
      fileSize: document.fileSize,
      storageKey: document.storageKey,
      updatedAt: document.updatedAt,
    };
    const history = ((document as any).versionHistory as any[]) || [];
    history.push(versionEntry);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: dto.storageKey,
        version: document.version + 1,
        uploadedBy: dto.uploadedBy,
        versionHistory: history,
      },
    });

    this.logger.log(
      `Document ${document.name} updated to version ${updated.version}`,
    );

    return updated;
  }
}
