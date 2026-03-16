'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { driveApi } from '@/lib/api/drive.api';
import type {
  FileQueryParams,
  CreateFolderDto,
  RenameFolderDto,
  MoveFileDto,
  ShareFileDto,
  UploadRequest,
  UploadConfirm,
  RequestNewVersionDto,
  ConfirmNewVersionDto,
} from '@/lib/types/drive.types';

// ─────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────
export const driveKeys = {
  all: ['drive'] as const,
  folders: (parentId?: string) => [...driveKeys.all, 'folders', parentId] as const,
  files: () => [...driveKeys.all, 'files'] as const,
  fileList: (params?: FileQueryParams) => [...driveKeys.files(), params] as const,
  file: (id: string) => [...driveKeys.all, 'file', id] as const,
  versions: (id: string) => [...driveKeys.all, 'versions', id] as const,
  shares: (id: string) => [...driveKeys.all, 'shares', id] as const,
  search: (q: string, mimeType?: string) => [...driveKeys.all, 'search', q, mimeType] as const,
  usage: () => [...driveKeys.all, 'usage'] as const,
};

// ─────────────────────────────────────────────
// FOLDERS
// ─────────────────────────────────────────────

export function useFolders(parentId?: string) {
  return useQuery({
    queryKey: driveKeys.folders(parentId),
    queryFn: () => driveApi.getFolders(parentId),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateFolderDto) => driveApi.createFolder(dto),
    onSuccess: (_data, dto) => {
      qc.invalidateQueries({ queryKey: driveKeys.folders(dto.parentId) });
      qc.invalidateQueries({ queryKey: driveKeys.folders(undefined) });
      toast.success('Tạo thư mục thành công');
    },
    onError: () => {
      toast.error('Không thể tạo thư mục');
    },
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RenameFolderDto }) =>
      driveApi.renameFolder(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.all });
      toast.success('Đổi tên thư mục thành công');
    },
    onError: () => {
      toast.error('Không thể đổi tên thư mục');
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driveApi.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.all });
      toast.success('Đã xoá thư mục');
    },
    onError: () => {
      toast.error('Không thể xoá thư mục');
    },
  });
}

// ─────────────────────────────────────────────
// FILES — Queries
// ─────────────────────────────────────────────

export function useFiles(params?: FileQueryParams) {
  return useQuery({
    queryKey: driveKeys.fileList(params),
    queryFn: () => driveApi.getFiles(params),
  });
}

export function useFile(id: string) {
  return useQuery({
    queryKey: driveKeys.file(id),
    queryFn: () => driveApi.getFile(id),
    enabled: !!id,
  });
}

// ─────────────────────────────────────────────
// FILES — Upload mutations
// ─────────────────────────────────────────────

export function useRequestUpload() {
  return useMutation({
    mutationFn: (dto: UploadRequest) => driveApi.requestUpload(dto),
    onError: () => {
      toast.error('Không thể tạo URL upload');
    },
  });
}

export function useConfirmUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UploadConfirm) => driveApi.confirmUpload(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.files() });
      qc.invalidateQueries({ queryKey: driveKeys.usage() });
      toast.success('Upload thành công');
    },
    onError: () => {
      toast.error('Không thể xác nhận upload');
    },
  });
}

// ─────────────────────────────────────────────
// FILES — Mutations
// ─────────────────────────────────────────────

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => driveApi.deleteFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.files() });
      qc.invalidateQueries({ queryKey: driveKeys.usage() });
      toast.success('Đã xoá file');
    },
    onError: () => {
      toast.error('Không thể xoá file');
    },
  });
}

export function useMoveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: MoveFileDto }) =>
      driveApi.moveFile(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.files() });
      toast.success('Di chuyển file thành công');
    },
    onError: () => {
      toast.error('Không thể di chuyển file');
    },
  });
}

// ─────────────────────────────────────────────
// VERSIONS
// ─────────────────────────────────────────────

export function useFileVersions(fileId: string) {
  return useQuery({
    queryKey: driveKeys.versions(fileId),
    queryFn: () => driveApi.getVersions(fileId),
    enabled: !!fileId,
  });
}

export function useRequestNewVersion() {
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RequestNewVersionDto }) =>
      driveApi.requestNewVersion(id, dto),
    onError: () => {
      toast.error('Không thể tạo URL upload phiên bản mới');
    },
  });
}

export function useConfirmNewVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ConfirmNewVersionDto }) =>
      driveApi.confirmNewVersion(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: driveKeys.file(id) });
      qc.invalidateQueries({ queryKey: driveKeys.versions(id) });
      toast.success('Đã cập nhật phiên bản mới');
    },
    onError: () => {
      toast.error('Không thể xác nhận phiên bản mới');
    },
  });
}

// ─────────────────────────────────────────────
// SHARES
// ─────────────────────────────────────────────

export function useFileShares(fileId: string, enabled = false) {
  return useQuery({
    queryKey: driveKeys.shares(fileId),
    queryFn: () => driveApi.getShares(fileId),
    enabled: !!fileId && enabled,
  });
}

export function useShareFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ShareFileDto }) =>
      driveApi.shareFile(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: driveKeys.shares(id) });
      toast.success('Chia sẻ thành công');
    },
    onError: () => {
      toast.error('Không thể chia sẻ file');
    },
  });
}

export function useRemoveShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => driveApi.removeShare(shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: driveKeys.all });
      toast.success('Đã xoá quyền truy cập');
    },
    onError: () => {
      toast.error('Không thể xoá quyền truy cập');
    },
  });
}

// ─────────────────────────────────────────────
// SEARCH / ANALYTICS
// ─────────────────────────────────────────────

export function useSearchFiles(q: string, mimeType?: string) {
  return useQuery({
    queryKey: driveKeys.search(q, mimeType),
    queryFn: () => driveApi.searchFiles(q, mimeType),
    enabled: q.length >= 2,
  });
}

export function useStorageUsage() {
  return useQuery({
    queryKey: driveKeys.usage(),
    queryFn: () => driveApi.getStorageUsage(),
  });
}
