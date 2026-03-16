import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type { SearchResult } from '@/lib/types/search.types';

export const searchApi = {
  /** GET /search?q=...&limit=20 */
  search: (query: string, limit = 20) =>
    apiClient
      .get<BaseResponse<SearchResult[]>>('/search', {
        params: { q: query, limit },
      })
      .then((r) => r.data.data ?? []),

  /** GET /search/recent */
  getRecent: () =>
    apiClient
      .get<BaseResponse<SearchResult[]>>('/search/recent')
      .then((r) => r.data.data ?? []),
};
