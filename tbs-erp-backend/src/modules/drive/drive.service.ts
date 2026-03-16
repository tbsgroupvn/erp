import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { StorageService } from '@core/storage/storage.service';
import { DriveRepository } from './drive.repository';
import {
  CreateFolderDto,
  RenameFolderDto,
  RequestUploadDto,
  ConfirmUploadDto,
  MoveFileDto,
  ShareFileDto,
  FileQueryDto,
  SearchFilesDto,
  RequestNewVersionDto,
  ConfirmNewVersionDto,
} from './dto';
import { randomBytes } from 'crypto';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly repo: DriveRepository,
  ) {}

  // ─────────────────────────────────────────────
  // FOLDERS
  // ─────────────────────────────────────────────

  async getFolders(userId: string, parentId?: string) {
    return this.repo.findFolders(userId, parentId);
  }

  async createFolder(userId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      const parent = await this.repo.findFolderById(dto.parentId, userId);
      if (!parent) {
        throw new NotFoundException('Thư mục cha không tồn tại hoặc không thuộc quyền của bạn');
      }
    }

    return this.prisma.driveFolder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        ownerId: userId,
        teamScope: dto.teamScope ?? null,
      },
    });
  }

  async renameFolder(userId: string, folderId: string, dto: RenameFolderDto) {
    const folder = await this.repo.findFolderById(folderId, userId);
    if (!folder) {
      throw new NotFoundException('Thư mục không tồn tại');
    }

    return this.prisma.driveFolder.update({
      where: { id: folderId },
      data: { name: dto.name },
    });
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.repo.findFolderById(folderId, userId);
    if (!folder) {
      throw new NotFoundException('Thư mục không tồn tại');
    }

    await this.prisma.driveFolder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Folder ${folderId} soft-deleted by ${userId}`);
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // FILES — Upload flow
  // ─────────────────────────────────────────────

  /**
   * Step 1: Generate presigned URL for direct browser upload.
   */
  async requestUpload(userId: string, dto: RequestUploadDto) {
    if (dto.folderId) {
      const folder = await this.repo.findFolderById(dto.folderId, userId);
      if (!folder) {
        throw new NotFoundException('Thư mục không tồn tại');
      }
    }

    const storageKey = this.storage.generateKey(userId, dto.filename);
    const uploadUrl = await this.storage.getPresignedUploadUrl(
      storageKey,
      dto.mimeType,
      undefined,
      3600,
    );

    return { uploadUrl, storageKey, expiresIn: 3600 };
  }

  /**
   * Step 2: After client finishes uploading to MinIO, confirm and create DB record.
   */
  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    const exists = await this.storage.objectExists(dto.storageKey);
    if (!exists) {
      throw new BadRequestException(
        'File chưa được upload lên storage hoặc storage key không hợp lệ',
      );
    }

    const file = await this.prisma.driveFile.create({
      data: {
        name: dto.filename,
        mimeType: dto.mimeType,
        size: dto.size,
        storageKey: dto.storageKey,
        folderId: dto.folderId ?? null,
        uploadedBy: userId,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        currentVersion: 1,
      },
    });

    // Create initial version record
    await this.prisma.driveFileVersion.create({
      data: {
        fileId: file.id,
        version: 1,
        storageKey: dto.storageKey,
        size: dto.size,
        uploadedBy: userId,
        changeNote: 'Initial upload',
      },
    });

    this.logger.log(`File confirmed: ${file.name} (${file.id}) by user ${userId}`);
    return file;
  }

  // ─────────────────────────────────────────────
  // FILES — Read / Download
  // ─────────────────────────────────────────────

  async getFiles(userId: string, query: FileQueryDto) {
    return this.repo.findFiles(userId, query);
  }

  async getFile(userId: string, fileId: string) {
    const file = await this.repo.findFileById(fileId);
    if (!file) {
      throw new NotFoundException('File không tồn tại');
    }
    this.assertCanAccess(file, userId);
    return file;
  }

  async getDownloadUrl(userId: string, fileId: string) {
    const file = await this.repo.findFileById(fileId);
    if (!file) {
      throw new NotFoundException('File không tồn tại');
    }
    this.assertCanAccess(file, userId);

    const url = await this.storage.getPresignedDownloadUrl(
      file.storageKey,
      file.bucket,
      3600,
    );
    return { url, filename: file.name, mimeType: file.mimeType };
  }

  // ─────────────────────────────────────────────
  // FILES — Move / Delete
  // ─────────────────────────────────────────────

  async moveFile(userId: string, fileId: string, dto: MoveFileDto) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    if (dto.folderId) {
      const folder = await this.repo.findFolderById(dto.folderId, userId);
      if (!folder) {
        throw new NotFoundException('Thư mục đích không tồn tại');
      }
    }

    return this.prisma.driveFile.update({
      where: { id: fileId },
      data: { folderId: dto.folderId ?? null },
    });
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    await this.prisma.driveFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`File ${file.name} soft-deleted by ${userId}`);
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // VERSIONS
  // ─────────────────────────────────────────────

  async getVersions(userId: string, fileId: string) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertCanAccess(file, userId);
    return file.versions;
  }

  /**
   * Step 1: Get presigned URL for uploading a new version.
   */
  async requestNewVersion(userId: string, fileId: string, dto: RequestNewVersionDto) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    const storageKey = this.storage.generateKey(userId, dto.filename);
    const uploadUrl = await this.storage.getPresignedUploadUrl(
      storageKey,
      dto.mimeType,
      file.bucket,
      3600,
    );

    return { uploadUrl, storageKey, expiresIn: 3600 };
  }

  /**
   * Step 2: Confirm new version after upload.
   */
  async confirmNewVersion(userId: string, fileId: string, dto: ConfirmNewVersionDto) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    const exists = await this.storage.objectExists(dto.storageKey, file.bucket);
    if (!exists) {
      throw new BadRequestException('File chưa được upload lên storage');
    }

    const newVersion = file.currentVersion + 1;

    const [updated] = await this.prisma.$transaction([
      this.prisma.driveFile.update({
        where: { id: fileId },
        data: {
          storageKey: dto.storageKey,
          size: dto.size,
          mimeType: dto.mimeType,
          currentVersion: newVersion,
        },
      }),
      this.prisma.driveFileVersion.create({
        data: {
          fileId,
          version: newVersion,
          storageKey: dto.storageKey,
          size: dto.size,
          uploadedBy: userId,
          changeNote: dto.changeNote ?? null,
        },
      }),
    ]);

    this.logger.log(`File ${file.name} updated to version ${newVersion} by ${userId}`);
    return updated;
  }

  // ─────────────────────────────────────────────
  // SHARES
  // ─────────────────────────────────────────────

  async shareFile(userId: string, fileId: string, dto: ShareFileDto) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    const shareToken =
      dto.generateLink ? randomBytes(24).toString('hex') : null;

    // Upsert: update if share for this user already exists
    if (dto.userId) {
      return this.prisma.driveFileShare.upsert({
        where: { fileId_userId: { fileId, userId: dto.userId } },
        update: {
          permission: dto.permission,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        create: {
          fileId,
          userId: dto.userId,
          permission: dto.permission,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          createdBy: userId,
          shareToken,
        },
      });
    }

    // Public link (no userId)
    return this.prisma.driveFileShare.create({
      data: {
        fileId,
        userId: null,
        permission: dto.permission,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: userId,
        shareToken,
      },
    });
  }

  async getShares(userId: string, fileId: string) {
    const file = await this.repo.findFileById(fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);
    return file.shares;
  }

  async removeShare(userId: string, shareId: string) {
    const share = await this.repo.findShareById(shareId);
    if (!share) throw new NotFoundException('Share không tồn tại');

    const file = await this.repo.findFileById(share.fileId);
    if (!file) throw new NotFoundException('File không tồn tại');
    this.assertIsOwner(file, userId);

    await this.prisma.driveFileShare.delete({ where: { id: shareId } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  // SEARCH / ANALYTICS
  // ─────────────────────────────────────────────

  async searchFiles(userId: string, dto: SearchFilesDto) {
    return this.repo.searchFiles(userId, dto.q, dto.mimeType);
  }

  async getStorageUsage(userId: string) {
    const totalBytes = await this.repo.getUserStorageUsage(userId);
    return {
      totalBytes,
      totalMB: Math.round(totalBytes / 1024 / 1024),
      totalGB: Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100,
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private assertIsOwner(file: { uploadedBy: string }, userId: string) {
    if (file.uploadedBy !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác file này');
    }
  }

  private assertCanAccess(
    file: { uploadedBy: string; shares: Array<{ userId: string | null }> },
    userId: string,
  ) {
    if (file.uploadedBy === userId) return;
    const hasShare = file.shares.some((s) => s.userId === userId);
    if (!hasShare) {
      throw new ForbiddenException('Bạn không có quyền truy cập file này');
    }
  }
}
