import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  WikiSpace,
  WikiPage,
  WikiPageNode,
  WikiPageVersion,
  WikiSearchResult,
  CreateSpaceDto,
  UpdateSpaceDto,
  CreatePageDto,
  UpdatePageDto,
  MovePageDto,
  WikiQueryDto,
} from '@/lib/types/wiki.types';

export const wikiApi = {
  // ============================================================
  // SPACES
  // ============================================================

  /** GET /wiki/spaces */
  getSpaces: () =>
    apiClient
      .get<BaseResponse<WikiSpace[]>>('/wiki/spaces')
      .then((r) => r.data.data),

  /** POST /wiki/spaces */
  createSpace: (dto: CreateSpaceDto) =>
    apiClient
      .post<BaseResponse<WikiSpace>>('/wiki/spaces', dto)
      .then((r) => r.data.data),

  /** GET /wiki/spaces/:slug */
  getSpaceBySlug: (slug: string) =>
    apiClient
      .get<BaseResponse<WikiSpace>>(`/wiki/spaces/${slug}`)
      .then((r) => r.data.data),

  /** PATCH /wiki/spaces/:id */
  updateSpace: (id: string, dto: UpdateSpaceDto) =>
    apiClient
      .patch<BaseResponse<WikiSpace>>(`/wiki/spaces/${id}`, dto)
      .then((r) => r.data.data),

  /** DELETE /wiki/spaces/:id */
  deleteSpace: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/wiki/spaces/${id}`)
      .then((r) => r.data.data),

  // ============================================================
  // PAGES — Tree
  // ============================================================

  /** GET /wiki/spaces/:spaceId/pages */
  getPageTree: (spaceId: string) =>
    apiClient
      .get<BaseResponse<WikiPageNode[]>>(`/wiki/spaces/${spaceId}/pages`)
      .then((r) => r.data.data),

  // ============================================================
  // PAGES — CRUD
  // ============================================================

  /** POST /wiki/pages */
  createPage: (dto: CreatePageDto) =>
    apiClient
      .post<BaseResponse<WikiPage>>('/wiki/pages', dto)
      .then((r) => r.data.data),

  /** GET /wiki/pages/search?search=... */
  searchPages: (params: WikiQueryDto) =>
    apiClient
      .get<BaseResponse<WikiSearchResult[]>>('/wiki/pages/search', { params })
      .then((r) => r.data.data),

  /** GET /wiki/pages/:id */
  getPage: (id: string) =>
    apiClient
      .get<BaseResponse<WikiPage>>(`/wiki/pages/${id}`)
      .then((r) => r.data.data),

  /** PATCH /wiki/pages/:id */
  updatePage: (id: string, dto: UpdatePageDto) =>
    apiClient
      .patch<BaseResponse<WikiPage>>(`/wiki/pages/${id}`, dto)
      .then((r) => r.data.data),

  /** DELETE /wiki/pages/:id */
  deletePage: (id: string) =>
    apiClient
      .delete<BaseResponse<{ deleted: boolean }>>(`/wiki/pages/${id}`)
      .then((r) => r.data.data),

  /** PATCH /wiki/pages/:id/move */
  movePage: (id: string, dto: MovePageDto) =>
    apiClient
      .patch<BaseResponse<WikiPage>>(`/wiki/pages/${id}/move`, dto)
      .then((r) => r.data.data),

  // ============================================================
  // VERSIONS
  // ============================================================

  /** GET /wiki/pages/:id/versions */
  getVersions: (pageId: string) =>
    apiClient
      .get<BaseResponse<WikiPageVersion[]>>(`/wiki/pages/${pageId}/versions`)
      .then((r) => r.data.data),

  /** GET /wiki/pages/:id/versions/:v */
  getVersion: (pageId: string, version: number) =>
    apiClient
      .get<BaseResponse<WikiPageVersion>>(`/wiki/pages/${pageId}/versions/${version}`)
      .then((r) => r.data.data),
};
