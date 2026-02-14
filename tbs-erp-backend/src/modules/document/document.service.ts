import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Uploads a document (stores metadata).
   */
  async upload(userId: string, dto: UploadDocumentDto) {
    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        entityType: dto.entityType,
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

    if (query.entityType) where.entityType = query.entityType;
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
      where: { entityType, entityId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Generates a download URL (stub for S3 presigned URL).
   */
  async getDownloadUrl(id: string) {
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
   * Soft deletes a document.
   */
  async delete(id: string, userId: string) {
    const document = await this.findById(id);

    await this.prisma.document.update({
      where: { id },
      data: { isDeleted: true },
    });

    this.logger.log(`Document ${document.name} soft-deleted by ${userId}`);
    return { deleted: true };
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

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey: dto.storageKey,
        version: document.version + 1,
        uploadedBy: dto.uploadedBy,
      },
    });

    this.logger.log(
      `Document ${document.name} updated to version ${updated.version}`,
    );

    return updated;
  }
}
