import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';

export interface CustomEmoji {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  uploadedBy: string;
  usageCount: number;
  createdAt: string;
}

export interface CreateEmojiPayload {
  name: string;
  imageUrl: string;
  category?: string;
}

export const emojiApi = {
  /** GET /emoji — lấy danh sách emoji */
  list: () =>
    apiClient
      .get<BaseResponse<CustomEmoji[]>>('/emoji')
      .then((r) => r.data.data ?? []),

  /** POST /emoji — upload emoji mới */
  create: (payload: CreateEmojiPayload) =>
    apiClient
      .post<BaseResponse<CustomEmoji>>('/emoji', payload)
      .then((r) => r.data.data),

  /** DELETE /emoji/:id — xóa emoji */
  remove: (id: string) =>
    apiClient
      .delete<BaseResponse<null>>(`/emoji/${id}`)
      .then((r) => r.data),

  /** POST /emoji/:id/use — increment usage count */
  incrementUsage: (id: string) =>
    apiClient
      .post<BaseResponse<CustomEmoji>>(`/emoji/${id}/use`)
      .then((r) => r.data.data),
};
