import { apiClient } from '../client';

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'image';
  group: string;
  label: string;
  hint?: string;
  order: number;
  isPublic: boolean;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettingDto {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'image';
  group: string;
  label: string;
  hint?: string;
  order?: number;
  isPublic?: boolean;
}

export const settingsApi = {
  create: (data: CreateSettingDto) =>
    apiClient.post<Setting>('/cms/settings', data),

  list: (group?: string) =>
    apiClient.get<Setting[]>('/cms/settings', { params: { group } }),

  getGroups: () =>
    apiClient.get<{ group: string; count: number }[]>('/cms/settings/groups'),

  getByGroup: (group: string) =>
    apiClient.get<Setting[]>(`/cms/settings/group/${group}`),

  getByKey: (key: string) =>
    apiClient.get<Setting>(`/cms/settings/${key}`),

  update: (key: string, data: Partial<CreateSettingDto>) =>
    apiClient.put<Setting>(`/cms/settings/${key}`, data),

  batchUpdate: (settings: { key: string; value: string }[]) =>
    apiClient.post('/cms/settings/batch-update', { settings }),

  delete: (key: string) =>
    apiClient.delete(`/cms/settings/${key}`),
};
