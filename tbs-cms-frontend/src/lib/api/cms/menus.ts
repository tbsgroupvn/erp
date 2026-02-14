import { apiClient } from '../client';

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  icon?: string;
  target: string;
  parentId?: string;
  order: number;
  isVisible: boolean;
  roles: string[];
  children?: MenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Menu {
  id: string;
  name: string;
  location: 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'MOBILE';
  isActive: boolean;
  items: MenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuDto {
  name: string;
  location: 'HEADER' | 'FOOTER' | 'SIDEBAR' | 'MOBILE';
  isActive?: boolean;
}

export interface CreateMenuItemDto {
  label: string;
  url: string;
  icon?: string;
  target?: string;
  parentId?: string;
  order?: number;
  isVisible?: boolean;
  roles?: string[];
}

export const menusApi = {
  // Menus
  createMenu: (data: CreateMenuDto) =>
    apiClient.post<Menu>('/cms/menus', data),

  listMenus: () =>
    apiClient.get<Menu[]>('/cms/menus'),

  getMenu: (id: string) =>
    apiClient.get<Menu>(`/cms/menus/${id}`),

  getMenuByLocation: (location: string, activeOnly = true) =>
    apiClient.get<Menu>(`/cms/menus/by-location/${location}`, {
      params: { activeOnly },
    }),

  updateMenu: (id: string, data: Partial<CreateMenuDto>) =>
    apiClient.patch<Menu>(`/cms/menus/${id}`, data),

  deleteMenu: (id: string) =>
    apiClient.delete(`/cms/menus/${id}`),

  // Menu Items
  createMenuItem: (menuId: string, data: CreateMenuItemDto) =>
    apiClient.post<MenuItem>(`/cms/menus/${menuId}/items`, data),

  getMenuItem: (id: string) =>
    apiClient.get<MenuItem>(`/cms/menus/items/${id}`),

  updateMenuItem: (id: string, data: Partial<CreateMenuItemDto>) =>
    apiClient.patch<MenuItem>(`/cms/menus/items/${id}`, data),

  deleteMenuItem: (id: string) =>
    apiClient.delete(`/cms/menus/items/${id}`),

  reorderMenuItems: (items: { id: string; order: number; parentId?: string }[]) =>
    apiClient.post('/cms/menus/items/reorder', { items }),
};
