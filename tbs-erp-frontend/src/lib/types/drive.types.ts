// ============================================
// DRIVE — Type Definitions
// ============================================

export type DrivePermission = 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'MANAGE';

export interface DriveFolder {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  teamScope: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: {
    children: number;
    files: number;
  };
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  bucket: string;
  folderId: string | null;
  folder?: { id: string; name: string } | null;
  uploadedBy: string;
  description: string | null;
  tags: string[];
  currentVersion: number;
  versions?: DriveFileVersion[];
  shares?: DriveFileShare[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DriveFileVersion {
  id: string;
  fileId: string;
  version: number;
  storageKey: string;
  size: number;
  uploadedBy: string;
  changeNote: string | null;
  createdAt: string;
}

export interface DriveFileShare {
  id: string;
  fileId: string;
  userId: string | null;
  permission: DrivePermission;
  shareToken: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface FileQueryParams {
  folderId?: string;
  search?: string;
  mimeType?: string;
  page?: number;
  limit?: number;
}

export interface UploadRequest {
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string;
  description?: string;
  tags?: string[];
}

export interface UploadConfirm {
  storageKey: string;
  filename: string;
  mimeType: string;
  size: number;
  folderId?: string;
  description?: string;
  tags?: string[];
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

export interface DownloadUrlResponse {
  url: string;
  filename: string;
  mimeType: string;
}

export interface CreateFolderDto {
  name: string;
  parentId?: string;
  teamScope?: string;
}

export interface RenameFolderDto {
  name: string;
}

export interface MoveFileDto {
  folderId?: string;
}

export interface ShareFileDto {
  userId?: string;
  permission: DrivePermission;
  expiresAt?: string;
  generateLink?: boolean;
}

export interface RequestNewVersionDto {
  filename: string;
  mimeType: string;
  size: number;
  changeNote?: string;
}

export interface ConfirmNewVersionDto {
  storageKey: string;
  size: number;
  mimeType: string;
  changeNote?: string;
}

export interface StorageUsage {
  totalBytes: number;
  totalMB: number;
  totalGB: number;
}

export interface DriveFilesPage {
  items: DriveFile[];
  total: number;
  page: number;
  limit: number;
}
