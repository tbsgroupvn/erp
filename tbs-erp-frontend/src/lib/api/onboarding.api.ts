import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

// ============================================
// ONBOARDING TYPES
// ============================================

export type ChecklistType = 'ONBOARDING' | 'OFFBOARDING';

export interface ChecklistItem {
  task: string;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
}

export interface OnboardingEmployee {
  id: string;
  code: string;
  fullName: string;
  positionTitle: string;
  departmentCode: string;
}

export interface OnboardingChecklist {
  id: string;
  employeeId: string;
  employee: OnboardingEmployee;
  type: ChecklistType;
  items: ChecklistItem[];
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChecklistDto {
  employeeId: string;
  type: ChecklistType;
}

export interface OnboardingQueryParams {
  type?: ChecklistType;
  completed?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// API METHODS
// ============================================

export const onboardingApi = {
  /** POST /onboarding */
  create: (data: CreateChecklistDto) =>
    apiClient
      .post<BaseResponse<OnboardingChecklist>>('/onboarding', data)
      .then((r) => r.data.data),

  /** GET /onboarding */
  list: (params?: OnboardingQueryParams) =>
    apiClient
      .get<PaginatedResponse<OnboardingChecklist>>('/onboarding', { params })
      .then((r) => r.data),

  /** GET /onboarding/employee/:employeeId */
  getByEmployee: (employeeId: string) =>
    apiClient
      .get<BaseResponse<OnboardingChecklist[]>>(`/onboarding/employee/${employeeId}`)
      .then((r) => r.data.data),

  /** GET /onboarding/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<OnboardingChecklist>>(`/onboarding/${id}`)
      .then((r) => r.data.data),

  /** PATCH /onboarding/:id/toggle/:itemIndex */
  toggleItem: (id: string, itemIndex: number) =>
    apiClient
      .patch<BaseResponse<OnboardingChecklist>>(`/onboarding/${id}/toggle/${itemIndex}`)
      .then((r) => r.data.data),

  /** PATCH /onboarding/:id/complete */
  markComplete: (id: string) =>
    apiClient
      .patch<BaseResponse<OnboardingChecklist>>(`/onboarding/${id}/complete`)
      .then((r) => r.data.data),
};
