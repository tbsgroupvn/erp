import { apiClient } from '../client';

export interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  template: string;
  featuredImage?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  parentId?: string;
  order: number;
  authorId: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; title: string; slug: string };
  children?: { id: string; title: string; slug: string }[];
}

export interface PageFilters {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  search?: string;
  parentId?: string;
  page?: number;
  limit?: number;
}

export interface CreatePageDto {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  template?: string;
  featuredImage?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  parentId?: string;
  order?: number;
}

export const pagesApi = {
  list: (filters?: PageFilters) =>
    apiClient.get<{ data: Page[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/cms/pages', { params: filters }),

  get: (id: string) =>
    apiClient.get<Page>(`/cms/pages/${id}`),

  create: (data: CreatePageDto) =>
    apiClient.post<Page>('/cms/pages', data),

  update: (id: string, data: Partial<CreatePageDto>) =>
    apiClient.patch<Page>(`/cms/pages/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cms/pages/${id}`),

  duplicate: (id: string) =>
    apiClient.post<Page>(`/cms/pages/${id}/duplicate`),

  reorder: (items: { id: string; order: number }[]) =>
    apiClient.post('/cms/pages/reorder', { items }),
};
