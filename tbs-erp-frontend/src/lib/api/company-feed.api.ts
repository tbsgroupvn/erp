import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  CompanyPost,
  PostsResponse,
  PostComment,
  CreatePostPayload,
  UpdatePostPayload,
  CreateCommentPayload,
  PostCategory,
} from '@/lib/types/company-feed.types';

export interface GetPostsParams {
  category?: PostCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export const companyFeedApi = {
  /** POST /company-feed/posts */
  createPost: (data: CreatePostPayload) =>
    apiClient
      .post<BaseResponse<CompanyPost>>('/company-feed/posts', data)
      .then((r) => r.data.data),

  /** GET /company-feed/posts */
  getPosts: (params?: GetPostsParams) =>
    apiClient
      .get<BaseResponse<PostsResponse>>('/company-feed/posts', { params })
      .then((r) => r.data.data),

  /** GET /company-feed/posts/pinned */
  getPinnedPosts: () =>
    apiClient
      .get<BaseResponse<CompanyPost[]>>('/company-feed/posts/pinned')
      .then((r) => r.data.data),

  /** GET /company-feed/posts/:id */
  getPost: (id: string) =>
    apiClient
      .get<BaseResponse<CompanyPost>>(`/company-feed/posts/${id}`)
      .then((r) => r.data.data),

  /** PATCH /company-feed/posts/:id */
  updatePost: (id: string, data: UpdatePostPayload) =>
    apiClient
      .patch<BaseResponse<CompanyPost>>(`/company-feed/posts/${id}`, data)
      .then((r) => r.data.data),

  /** DELETE /company-feed/posts/:id */
  deletePost: (id: string) =>
    apiClient
      .delete<BaseResponse<{ success: boolean }>>(`/company-feed/posts/${id}`)
      .then((r) => r.data.data),

  /** POST /company-feed/posts/:id/react */
  reactToPost: (id: string, type: string) =>
    apiClient
      .post<BaseResponse<{ action: string; type: string }>>(`/company-feed/posts/${id}/react`, { type })
      .then((r) => r.data.data),

  /** GET /company-feed/posts/:id/comments */
  getComments: (postId: string) =>
    apiClient
      .get<BaseResponse<PostComment[]>>(`/company-feed/posts/${postId}/comments`)
      .then((r) => r.data.data),

  /** POST /company-feed/posts/:id/comments */
  createComment: (postId: string, data: CreateCommentPayload) =>
    apiClient
      .post<BaseResponse<PostComment>>(`/company-feed/posts/${postId}/comments`, data)
      .then((r) => r.data.data),

  /** DELETE /company-feed/comments/:id */
  deleteComment: (commentId: string) =>
    apiClient
      .delete<BaseResponse<{ success: boolean }>>(`/company-feed/comments/${commentId}`)
      .then((r) => r.data.data),
};
