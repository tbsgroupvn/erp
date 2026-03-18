'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { blogApi } from '@/lib/api/blog';
import type {
  BlogPostQueryParams,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from '@/lib/api/blog';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const blogPostKeys = {
  all: ['blog-posts'] as const,
  lists: () => [...blogPostKeys.all, 'list'] as const,
  list: (params?: BlogPostQueryParams) =>
    [...blogPostKeys.lists(), params] as const,
  details: () => [...blogPostKeys.all, 'detail'] as const,
  detail: (id: string) => [...blogPostKeys.details(), id] as const,
  slugs: () => [...blogPostKeys.all, 'slug'] as const,
  slug: (slug: string) => [...blogPostKeys.slugs(), slug] as const,
  tags: () => [...blogPostKeys.all, 'tags'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBlogPosts(params?: BlogPostQueryParams) {
  return useQuery({
    queryKey: blogPostKeys.list(params),
    queryFn: () => blogApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useBlogPost(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: blogPostKeys.detail(id),
    queryFn: () => blogApi.getById(id),
    enabled: options?.enabled ?? !!id,
    staleTime: 60 * 1000,
  });
}

export function useBlogPostBySlug(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: blogPostKeys.slug(slug),
    queryFn: () => blogApi.getBySlug(slug),
    enabled: options?.enabled ?? !!slug,
    staleTime: 60 * 1000,
  });
}

export function useBlogTags() {
  return useQuery({
    queryKey: blogPostKeys.tags(),
    queryFn: () => blogApi.getTags(),
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBlogPostDto) => blogApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blogPostKeys.lists() });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.tags() });
      toast.success('Tạo bài viết thành công');
    },
  });
}

export function useUpdateBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlogPostDto }) =>
      blogApi.update(id, data),
    onSuccess: (updatedPost) => {
      queryClient.invalidateQueries({ queryKey: blogPostKeys.lists() });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.detail(updatedPost.id) });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.slug(updatedPost.slug) });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.tags() });
      toast.success('Cập nhật bài viết thành công');
    },
  });
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => blogApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blogPostKeys.lists() });
      queryClient.invalidateQueries({ queryKey: blogPostKeys.tags() });
      toast.success('Xóa bài viết thành công');
    },
  });
}

export function useIncrementBlogView() {
  return useMutation({
    mutationFn: (slug: string) => blogApi.incrementView(slug),
    onError: () => {
      // Silently fail - view count is not critical
    },
  });
}
