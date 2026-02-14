import { apiClient } from '../client';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'NEW' | 'READ' | 'REPLIED';
  createdAt: string;
  updatedAt: string;
}

export interface ContactFilters {
  status?: 'NEW' | 'READ' | 'REPLIED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface ContactStats {
  total: number;
  unread: number;
  today: number;
  week: number;
}

export const contactsApi = {
  getAll: (filters?: ContactFilters) =>
    apiClient.get<{ data: ContactSubmission[]; total: number }>('/cms/contacts', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: ContactSubmission }>(`/cms/contacts/${id}`),

  getStats: () =>
    apiClient.get<{ data: ContactStats }>('/cms/contacts/stats'),

  markAsRead: (id: string) =>
    apiClient.patch<{ data: ContactSubmission }>(`/cms/contacts/${id}/read`),

  markAsReplied: (id: string) =>
    apiClient.patch<{ data: ContactSubmission }>(`/cms/contacts/${id}/replied`),

  delete: (id: string) =>
    apiClient.delete(`/cms/contacts/${id}`),

  exportToExcel: () =>
    apiClient.get('/cms/contacts/export', { responseType: 'blob' }),
};
