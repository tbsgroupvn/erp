import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { FileQueryDto } from './dto';

@Injectable()
export class DriveRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get folder tree for a user, optionally under a parent folder.
   */
  async findFolders(userId: string, parentId?: string) {
    return this.prisma.driveFolder.findMany({
      where: {
        ownerId: userId,
        parentId: parentId ?? null,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { children: true, files: true },
        },
      },
    });
  }

  /**
   * Find a folder by ID, checking ownership.
   */
  async findFolderById(id: string, userId: string) {
    return this.prisma.driveFolder.findFirst({
      where: { id, ownerId: userId, deletedAt: null },
    });
  }

  /**
   * Paginated file list with optional search and mime type filter.
   */
  async findFiles(userId: string, query: FileQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DriveFileWhereInput = {
      uploadedBy: userId,
      deletedAt: null,
      folderId: query.folderId !== undefined ? (query.folderId || null) : undefined,
    };

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query.mimeType) {
      where.mimeType = { startsWith: query.mimeType };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.driveFile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driveFile.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Find file by ID, including versions and shares.
   */
  async findFileById(id: string) {
    return this.prisma.driveFile.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' } },
        shares: true,
        folder: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Full text search on file name and tags.
   */
  async searchFiles(userId: string, query: string, mimeType?: string) {
    const where: Prisma.DriveFileWhereInput = {
      uploadedBy: userId,
      deletedAt: null,
      name: { contains: query, mode: 'insensitive' },
    };

    if (mimeType) {
      where.mimeType = { startsWith: mimeType };
    }

    return this.prisma.driveFile.findMany({
      where,
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: { folder: { select: { id: true, name: true } } },
    });
  }

  /**
   * Total bytes uploaded by user (non-deleted files).
   */
  async getUserStorageUsage(userId: string): Promise<number> {
    const result = await this.prisma.driveFile.aggregate({
      where: { uploadedBy: userId, deletedAt: null },
      _sum: { size: true },
    });
    return result._sum.size ?? 0;
  }

  /**
   * Find share record by ID.
   */
  async findShareById(shareId: string) {
    return this.prisma.driveFileShare.findUnique({ where: { id: shareId } });
  }

  /**
   * Check if user has at least VIEW permission for a file (via share record).
   */
  async getUserFilePermission(
    fileId: string,
    userId: string,
  ): Promise<string | null> {
    const share = await this.prisma.driveFileShare.findFirst({
      where: { fileId, userId },
    });
    return share?.permission ?? null;
  }
}
