import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';
import type {
  DriveFolder,
  DriveFile,
  DriveFileVersion,
  DriveFileShare,
  DriveFilesPage,
  FileQueryParams,
  CreateFolderDto,
  RenameFolderDto,
  MoveFileDto,
  ShareFileDto,
  UploadRequest,
  UploadConfirm,
  PresignedUploadResponse,
  DownloadUrlResponse,
  StorageUsage,
  RequestNewVersionDto,
  ConfirmNewVersionDto,
} from '@/lib/types/drive.types';

export const driveApi = {
  // ─────────────────────────────────────────────
  // FOLDERS
  // ─────────────────────────────────────────────

  /** GET /drive/folders?parentId= */
  getFolders: (parentId?: string) =>
    apiClient
      .get<BaseResponse<DriveFolder[]>>('/drive/folders', { params: parentId ? { parentId } : {} })
      .then((r) => r.data.data),

  /** POST /drive/folders */
  createFolder: (dto: CreateFolderDto) =>
    apiClient
      .post<BaseResponse<DriveFolder>>('/drive/folders', dto)
      .then((r) => r.data.data),

  /** PATCH /drive/folders/:id */
  renameFolder: (id: string, dto: RenameFolderDto) =>
    apiClient
      .patch<BaseResponse<DriveFolder>>(`/drive/folders/${id}`, dto)
      .then((r) => r.data.data),

  /** DELETE /drive/folders/:id */
  deleteFolder: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/drive/folders/${id}`)
      .then((r) => r.data.data),

  // ─────────────────────────────────────────────
  // FILES — CRUD
  // ─────────────────────────────────────────────

  /** GET /drive/files */
  getFiles: (params?: FileQueryParams) =>
    apiClient
      .get<PaginatedResponse<DriveFile>>('/drive/files', { params })
      .then((r) => r.data),

  /** GET /drive/files/:id */
  getFile: (id: string) =>
    apiClient
      .get<BaseResponse<DriveFile>>(`/drive/files/${id}`)
      .then((r) => r.data.data),

  /** GET /drive/files/:id/download */
  getDownloadUrl: (id: string) =>
    apiClient
      .get<BaseResponse<DownloadUrlResponse>>(`/drive/files/${id}/download`)
      .then((r) => r.data.data),

  /** PATCH /drive/files/:id/move */
  moveFile: (id: string, dto: MoveFileDto) =>
    apiClient
      .patch<BaseResponse<DriveFile>>(`/drive/files/${id}/move`, dto)
      .then((r) => r.data.data),

  /** DELETE /drive/files/:id */
  deleteFile: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/drive/files/${id}`)
      .then((r) => r.data.data),

  // ─────────────────────────────────────────────
  // FILES — Upload flow
  // ─────────────────────────────────────────────

  /** POST /drive/files/request-upload */
  requestUpload: (dto: UploadRequest) =>
    apiClient
      .post<BaseResponse<PresignedUploadResponse>>('/drive/files/request-upload', dto)
      .then((r) => r.data.data),

  /** POST /drive/files/confirm-upload */
  confirmUpload: (dto: UploadConfirm) =>
    apiClient
      .post<BaseResponse<DriveFile>>('/drive/files/confirm-upload', dto)
      .then((r) => r.data.data),

  // ─────────────────────────────────────────────
  // VERSIONS
  // ─────────────────────────────────────────────

  /** GET /drive/files/:id/versions */
  getVersions: (id: string) =>
    apiClient
      .get<BaseResponse<DriveFileVersion[]>>(`/drive/files/${id}/versions`)
      .then((r) => r.data.data),

  /** POST /drive/files/:id/versions — request presigned URL for new version */
  requestNewVersion: (id: string, dto: RequestNewVersionDto) =>
    apiClient
      .post<BaseResponse<PresignedUploadResponse>>(`/drive/files/${id}/versions`, dto)
      .then((r) => r.data.data),

  /** POST /drive/files/:id/versions/confirm */
  confirmNewVersion: (id: string, dto: ConfirmNewVersionDto) =>
    apiClient
      .post<BaseResponse<DriveFile>>(`/drive/files/${id}/versions/confirm`, dto)
      .then((r) => r.data.data),

  // ─────────────────────────────────────────────
  // SHARES
  // ─────────────────────────────────────────────

  /** POST /drive/files/:id/share */
  shareFile: (id: string, dto: ShareFileDto) =>
    apiClient
      .post<BaseResponse<DriveFileShare>>(`/drive/files/${id}/share`, dto)
      .then((r) => r.data.data),

  /** GET /drive/files/:id/shares */
  getShares: (id: string) =>
    apiClient
      .get<BaseResponse<DriveFileShare[]>>(`/drive/files/${id}/shares`)
      .then((r) => r.data.data),

  /** DELETE /drive/shares/:shareId */
  removeShare: (shareId: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/drive/shares/${shareId}`)
      .then((r) => r.data.data),

  // ─────────────────────────────────────────────
  // SEARCH / ANALYTICS
  // ─────────────────────────────────────────────

  /** GET /drive/search?q=&mimeType= */
  searchFiles: (q: string, mimeType?: string) =>
    apiClient
      .get<BaseResponse<DriveFile[]>>('/drive/search', { params: { q, mimeType } })
      .then((r) => r.data.data),

  /** GET /drive/storage-usage */
  getStorageUsage: () =>
    apiClient
      .get<BaseResponse<StorageUsage>>('/drive/storage-usage')
      .then((r) => r.data.data),
};
