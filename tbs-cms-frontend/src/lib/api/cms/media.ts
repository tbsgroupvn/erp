import { apiClient } from '../client';

export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
  path: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  caption?: string;
  folder?: string;
  tags: string[];
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFilters {
  type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
  folder?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface UpdateMediaDto {
  alt?: string;
  caption?: string;
  folder?: string;
  tags?: string[];
}

export const mediaApi = {
  upload: (file: File, folder?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);

    return apiClient.post<Media>('/cms/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadMultiple: (files: File[], folder?: string) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (folder) formData.append('folder', folder);

    return apiClient.post<Media[]>('/cms/media/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  list: (filters?: MediaFilters) =>
    apiClient.get<{ data: Media[]; meta: any }>('/cms/media', { params: filters }),

  get: (id: string) =>
    apiClient.get<Media>(`/cms/media/${id}`),

  update: (id: string, data: UpdateMediaDto) =>
    apiClient.patch<Media>(`/cms/media/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cms/media/${id}`),

  bulkDelete: (ids: string[]) =>
    apiClient.post('/cms/media/bulk-delete', { ids }),

  move: (id: string, folder: string | null) =>
    apiClient.post(`/cms/media/${id}/move`, { folder }),

  getFolders: () =>
    apiClient.get<{ folder: string; count: number }[]>('/cms/media/folders'),

  getStats: () =>
    apiClient.get<{
      total: number;
      byType: { type: string; count: number }[];
      totalSize: number;
      totalSizeMB: number;
    }>('/cms/media/stats'),
};
