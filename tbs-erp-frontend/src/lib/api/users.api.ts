import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse, QueryParams } from '@/lib/types';
import type { UserRole } from '@/lib/types/enums';

// ============================================
// TYPES
// ============================================

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserQueryParams extends QueryParams {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export interface CreateUserDto {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
  employeeId?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
  employeeId?: string;
}

// ============================================
// USERS API
// ============================================

export const usersApi = {
  /** GET /users */
  list: (params?: UserQueryParams) =>
    apiClient
      .get<PaginatedResponse<UserAccount>>('/users', { params })
      .then((r) => r.data),

  /** GET /users/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<UserAccount>>(`/users/${id}`)
      .then((r) => r.data.data),

  /** POST /users */
  create: (data: CreateUserDto) =>
    apiClient
      .post<BaseResponse<UserAccount>>('/users', data)
      .then((r) => r.data.data),

  /** PATCH /users/:id */
  update: (id: string, data: UpdateUserDto) =>
    apiClient
      .patch<BaseResponse<UserAccount>>(`/users/${id}`, data)
      .then((r) => r.data.data),

  /** PATCH /users/:id/role */
  updateRole: (id: string, role: UserRole) =>
    apiClient
      .patch<BaseResponse<UserAccount>>(`/users/${id}/role`, { role })
      .then((r) => r.data.data),

  /** PATCH /users/:id/activate */
  activate: (id: string) =>
    apiClient
      .patch<BaseResponse<UserAccount>>(`/users/${id}/activate`)
      .then((r) => r.data.data),

  /** PATCH /users/:id/deactivate */
  deactivate: (id: string) =>
    apiClient
      .patch<BaseResponse<UserAccount>>(`/users/${id}/deactivate`)
      .then((r) => r.data.data),

  /** POST /users/:id/reset-password */
  resetPassword: (id: string) =>
    apiClient
      .post<BaseResponse<{ temporaryPassword: string }>>(`/users/${id}/reset-password`)
      .then((r) => r.data.data),
};
