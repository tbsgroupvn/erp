'use client';

import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companyFeedApi } from '@/lib/api/company-feed.api';
import type {
  CreatePostPayload,
  UpdatePostPayload,
  CreateCommentPayload,
  PostCategory,
} from '@/lib/types/company-feed.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const feedKeys = {
  all: ['company-feed'] as const,
  posts: (params?: { category?: PostCategory; search?: string }) => [...feedKeys.all, 'posts', params] as const,
  post: (id: string) => [...feedKeys.all, 'post', id] as const,
  pinned: () => [...feedKeys.all, 'pinned'] as const,
  comments: (postId: string) => [...feedKeys.all, 'comments', postId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePosts(params?: { category?: PostCategory; search?: string }) {
  return useInfiniteQuery({
    queryKey: feedKeys.posts(params),
    queryFn: ({ pageParam = 1 }) =>
      companyFeedApi.getPosts({ ...params, page: pageParam as number, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function usePinnedPosts() {
  return useQuery({
    queryKey: feedKeys.pinned(),
    queryFn: companyFeedApi.getPinnedPosts,
    staleTime: 60_000,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: feedKeys.post(id),
    queryFn: () => companyFeedApi.getPost(id),
    enabled: !!id,
  });
}

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: feedKeys.comments(postId),
    queryFn: () => companyFeedApi.getComments(postId),
    enabled: !!postId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostPayload) => companyFeedApi.createPost(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.all });
      toast.success('Đăng bài thành công');
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePostPayload }) =>
      companyFeedApi.updatePost(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: feedKeys.post(id) });
      qc.invalidateQueries({ queryKey: feedKeys.all });
      toast.success('Cập nhật bài viết thành công');
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companyFeedApi.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.all });
      toast.success('Bài viết đã được xóa');
    },
  });
}

export function useReactToPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      companyFeedApi.reactToPost(id, type),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: feedKeys.posts() });
      qc.invalidateQueries({ queryKey: feedKeys.post(id) });
    },
  });
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommentPayload) => companyFeedApi.createComment(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      qc.invalidateQueries({ queryKey: feedKeys.post(postId) });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, postId }: { commentId: string; postId: string }) =>
      companyFeedApi.deleteComment(commentId),
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      qc.invalidateQueries({ queryKey: feedKeys.post(postId) });
    },
  });
}
