'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wikiApi } from '@/lib/api/wiki.api';
import type {
  CreateSpaceDto,
  UpdateSpaceDto,
  CreatePageDto,
  UpdatePageDto,
  MovePageDto,
  WikiQueryDto,
} from '@/lib/types/wiki.types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const wikiKeys = {
  all: ['wiki'] as const,
  spaces: () => [...wikiKeys.all, 'spaces'] as const,
  space: (slug: string) => [...wikiKeys.spaces(), slug] as const,
  pageTree: (spaceId: string) => [...wikiKeys.all, 'pageTree', spaceId] as const,
  pages: () => [...wikiKeys.all, 'pages'] as const,
  page: (id: string) => [...wikiKeys.pages(), id] as const,
  search: (query: WikiQueryDto) => [...wikiKeys.all, 'search', query] as const,
  versions: (pageId: string) => [...wikiKeys.all, 'versions', pageId] as const,
  version: (pageId: string, v: number) => [...wikiKeys.versions(pageId), v] as const,
};

// ---------------------------------------------------------------------------
// SPACE Queries
// ---------------------------------------------------------------------------

export function useWikiSpaces() {
  return useQuery({
    queryKey: wikiKeys.spaces(),
    queryFn: () => wikiApi.getSpaces(),
  });
}

export function useWikiSpace(slug: string) {
  return useQuery({
    queryKey: wikiKeys.space(slug),
    queryFn: () => wikiApi.getSpaceBySlug(slug),
    enabled: !!slug,
  });
}

// ---------------------------------------------------------------------------
// SPACE Mutations
// ---------------------------------------------------------------------------

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSpaceDto) => wikiApi.createSpace(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.spaces() });
      toast.success('Space đã được tạo');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể tạo space');
    },
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSpaceDto }) =>
      wikiApi.updateSpace(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.spaces() });
      toast.success('Space đã được cập nhật');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể cập nhật space');
    },
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wikiApi.deleteSpace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.spaces() });
      toast.success('Space đã được xóa');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể xóa space');
    },
  });
}

// ---------------------------------------------------------------------------
// PAGE Queries
// ---------------------------------------------------------------------------

export function usePageTree(spaceId: string) {
  return useQuery({
    queryKey: wikiKeys.pageTree(spaceId),
    queryFn: () => wikiApi.getPageTree(spaceId),
    enabled: !!spaceId,
  });
}

export function useWikiPage(id: string) {
  return useQuery({
    queryKey: wikiKeys.page(id),
    queryFn: () => wikiApi.getPage(id),
    enabled: !!id,
  });
}

export function useWikiSearch(query: WikiQueryDto) {
  return useQuery({
    queryKey: wikiKeys.search(query),
    queryFn: () => wikiApi.searchPages(query),
    enabled: !!query.search && query.search.length >= 2,
    staleTime: 10_000,
  });
}

export function usePageVersions(pageId: string) {
  return useQuery({
    queryKey: wikiKeys.versions(pageId),
    queryFn: () => wikiApi.getVersions(pageId),
    enabled: !!pageId,
  });
}

export function usePageVersion(pageId: string, version: number) {
  return useQuery({
    queryKey: wikiKeys.version(pageId, version),
    queryFn: () => wikiApi.getVersion(pageId, version),
    enabled: !!pageId && version > 0,
  });
}

// ---------------------------------------------------------------------------
// PAGE Mutations
// ---------------------------------------------------------------------------

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePageDto) => wikiApi.createPage(dto),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: wikiKeys.pageTree(data.spaceId) });
      toast.success('Trang đã được tạo');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể tạo trang');
    },
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePageDto }) =>
      wikiApi.updatePage(id, dto),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: wikiKeys.page(data.id) });
      qc.invalidateQueries({ queryKey: wikiKeys.pageTree(data.spaceId) });
      qc.invalidateQueries({ queryKey: wikiKeys.versions(data.id) });
      toast.success('Trang đã được lưu');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể lưu trang');
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, spaceId }: { id: string; spaceId: string }) =>
      wikiApi.deletePage(id).then((r) => ({ ...r, spaceId })),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: wikiKeys.pageTree(data.spaceId) });
      toast.success('Trang đã được xóa');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể xóa trang');
    },
  });
}

export function useMovePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: MovePageDto }) =>
      wikiApi.movePage(id, dto),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: wikiKeys.pageTree(data.spaceId) });
      toast.success('Trang đã được di chuyển');
    },
    onError: (err: unknown) => {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể di chuyển trang');
    },
  });
}
