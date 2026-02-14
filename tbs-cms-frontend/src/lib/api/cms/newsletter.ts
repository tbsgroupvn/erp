import { apiClient } from '../client';

export interface NewsletterSubscription {
  id: string;
  email: string;
  status: 'ACTIVE' | 'UNSUBSCRIBED';
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterFilters {
  status?: 'ACTIVE' | 'UNSUBSCRIBED';
  search?: string;
  page?: number;
  limit?: number;
}

export const newsletterApi = {
  getAll: (filters?: NewsletterFilters) =>
    apiClient.get<{ data: NewsletterSubscription[]; total: number }>('/cms/newsletter', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: NewsletterSubscription }>(`/cms/newsletter/${id}`),

  unsubscribe: (id: string) =>
    apiClient.patch<{ data: NewsletterSubscription }>(`/cms/newsletter/${id}/unsubscribe`),

  delete: (id: string) =>
    apiClient.delete(`/cms/newsletter/${id}`),

  exportToExcel: () =>
    apiClient.get('/cms/newsletter/export', { responseType: 'blob' }),
};
