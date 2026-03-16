import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { MediaType, Prisma } from '@prisma/client';
import { UpdateMediaDto, MediaFiltersDto } from './dto';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileTypeFromBuffer } from 'file-type';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private uploadDir = './uploads';
  private thumbnailDir = './uploads/thumbnails';

  constructor(private readonly prisma: PrismaService) {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directories:', error);
    }
  }

  /**
   * Validate file signature (magic numbers) to prevent MIME type spoofing
   * @param filePath Path to the uploaded file
   * @param declaredMimeType MIME type from HTTP header
   * @throws BadRequestException if file signature doesn't match declared type
   */
  private async validateFileSignature(filePath: string, declaredMimeType: string): Promise<void> {
    // Whitelist of allowed MIME types with their expected signatures
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'image/x-icon',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Video
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
    ];

    // Check if declared type is in whitelist
    if (!allowedTypes.includes(declaredMimeType)) {
      throw new BadRequestException(`File type not allowed: ${declaredMimeType}`);
    }

    // Read file header (first 4100 bytes is enough for most file types)
    const buffer = Buffer.alloc(4100);
    const fileHandle = await fs.open(filePath, 'r');
    try {
      await fileHandle.read(buffer, 0, 4100, 0);
    } finally {
      await fileHandle.close();
    }

    // Detect actual file type from magic numbers
    const detectedType = await fileTypeFromBuffer(buffer);

    // Special handling for SVG (text-based, no magic number)
    if (declaredMimeType === 'image/svg+xml') {
      const content = buffer.toString('utf-8', 0, 100);
      if (!content.includes('<svg') && !content.includes('<?xml')) {
        throw new BadRequestException('File signature validation failed: Not a valid SVG file');
      }
      return; // SVG is valid
    }

    // Validate detected type matches declared type
    if (!detectedType) {
      throw new BadRequestException(
        'File signature validation failed: Unable to detect file type from content',
      );
    }

    // Some MIME types have variations (e.g., image/jpg vs image/jpeg)
    const normalizedDeclared = declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType;
    const normalizedDetected = detectedType.mime === 'image/jpg' ? 'image/jpeg' : detectedType.mime;

    if (normalizedDetected !== normalizedDeclared) {
      throw new BadRequestException(
        `File signature validation failed: Declared type "${declaredMimeType}" doesn't match actual type "${detectedType.mime}"`,
      );
    }
  }

  async upload(file: Express.Multer.File, userId: string, folder?: string) {
    // SECURITY: Validate file signature before processing
    await this.validateFileSignature(file.path, file.mimetype);

    const filename = file.filename;
    const filePath = path.join(this.uploadDir, filename);
    const url = `/uploads/${filename}`;

    let thumbnailUrl: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    const duration: number | null = null;

    // Determine media type
    const type = this.getMediaType(file.mimetype);

    // Process images
    if (type === MediaType.IMAGE && file.mimetype !== 'image/svg+xml') {
      try {
        const image = sharp(file.path);
        const metadata = await image.metadata();
        width = metadata.width || null;
        height = metadata.height || null;

        // Generate thumbnail
        const thumbnailFilename = `thumb-${filename}`;
        const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);

        await image
          .resize(300, 300, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFile(thumbnailPath);

        thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
      } catch (error) {
        this.logger.error('Image processing error:', error);
      }
    }

    // For SVG, get dimensions from file
    if (file.mimetype === 'image/svg+xml') {
      try {
        const svgContent = await fs.readFile(file.path, 'utf-8');
        const widthMatch = svgContent.match(/width="(\d+)"/);
        const heightMatch = svgContent.match(/height="(\d+)"/);
        width = widthMatch ? parseInt(widthMatch[1]) : null;
        height = heightMatch ? parseInt(heightMatch[1]) : null;
      } catch (error) {
        this.logger.error('SVG processing error:', error);
      }
    }

    // Save to database
    return this.prisma.media.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
        path: filePath,
        url,
        thumbnailUrl,
        width,
        height,
        duration,
        folder: folder || null,
        uploadedBy: userId,
      },
    });
  }

  async uploadMultiple(files: Express.Multer.File[], userId: string, folder?: string) {
    const uploads = await Promise.all(files.map((file) => this.upload(file, userId, folder)));
    return uploads;
  }

  private getMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return MediaType.IMAGE;
    if (mimeType.startsWith('video/')) return MediaType.VIDEO;
    if (mimeType.startsWith('audio/')) return MediaType.AUDIO;
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('sheet') ||
      mimeType.includes('presentation')
    ) {
      return MediaType.DOCUMENT;
    }
    return MediaType.OTHER;
  }

  async findAll(filters: MediaFiltersDto) {
    const { type, folder, search, tags, page = 1, limit = 50 } = filters;

    // Use Prisma's generated type for type safety
    const where: Prisma.MediaWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (folder !== undefined) {
      where.folder = folder === 'null' ? null : folder;
    }

    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID "${id}" not found`);
    }

    return media;
  }

  async update(id: string, dto: UpdateMediaDto) {
    await this.findOne(id);

    return this.prisma.media.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const media = await this.findOne(id);

    try {
      // Delete file
      await fs.unlink(media.path);

      // Delete thumbnail if exists
      if (media.thumbnailUrl) {
        const thumbnailPath = path.join(this.thumbnailDir, path.basename(media.thumbnailUrl));
        await fs.unlink(thumbnailPath).catch(() => {
          // Ignore if thumbnail doesn't exist
        });
      }
    } catch (error) {
      this.logger.error('File deletion error:', error);
      // Continue with database deletion even if file deletion fails
    }

    return this.prisma.media.delete({
      where: { id },
    });
  }

  async bulkDelete(ids: string[]) {
    const media = await this.prisma.media.findMany({
      where: { id: { in: ids } },
    });

    // Delete files
    await Promise.all(
      media.map(async (item) => {
        try {
          await fs.unlink(item.path);
          if (item.thumbnailUrl) {
            const thumbnailPath = path.join(this.thumbnailDir, path.basename(item.thumbnailUrl));
            await fs.unlink(thumbnailPath).catch(() => {});
          }
        } catch (error) {
          this.logger.error('File deletion error:', error);
        }
      }),
    );

    // Delete from database
    return this.prisma.media.deleteMany({
      where: { id: { in: ids } },
    });
  }

  async move(id: string, folder: string | null) {
    await this.findOne(id);

    return this.prisma.media.update({
      where: { id },
      data: { folder },
    });
  }

  async getFolders() {
    const result = await this.prisma.media.groupBy({
      by: ['folder'],
      where: {
        folder: { not: null },
      },
      _count: true,
    });

    return result.map((item) => ({
      folder: item.folder,
      count: item._count,
    }));
  }

  async getStats() {
    const [total, byType, totalSize] = await Promise.all([
      this.prisma.media.count(),
      this.prisma.media.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.media.aggregate({
        _sum: { size: true },
      }),
    ]);

    return {
      total,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count,
      })),
      totalSize: totalSize._sum.size || 0,
      totalSizeMB: Math.round((totalSize._sum.size || 0) / (1024 * 1024)),
    };
  }
}
