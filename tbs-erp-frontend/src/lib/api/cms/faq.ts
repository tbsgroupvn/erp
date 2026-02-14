import { apiClient } from '../client';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFAQDto {
  question: string;
  answer: string;
  category: string;
  order?: number;
  isPublished?: boolean;
}

export interface FAQFilters {
  category?: string;
  isPublished?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const faqApi = {
  getAll: (filters?: FAQFilters) =>
    apiClient.get<{ data: FAQ[]; total: number }>('/cms/faq', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: FAQ }>(`/cms/faq/${id}`),

  create: (data: CreateFAQDto) =>
    apiClient.post<{ data: FAQ }>('/cms/faq', data),

  update: (id: string, data: Partial<CreateFAQDto>) =>
    apiClient.patch<{ data: FAQ }>(`/cms/faq/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/cms/faq/${id}`),

  publish: (id: string) =>
    apiClient.patch<{ data: FAQ }>(`/cms/faq/${id}/publish`),

  unpublish: (id: string) =>
    apiClient.patch<{ data: FAQ }>(`/cms/faq/${id}/unpublish`),

  incrementViews: (id: string) =>
    apiClient.post(`/cms/faq/${id}/view`),
};
