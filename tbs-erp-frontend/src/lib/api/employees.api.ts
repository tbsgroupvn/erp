import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryParams,
  Headcount,
} from '@/lib/types';

export const employeesApi = {
  /** GET /employees */
  list: (params?: EmployeeQueryParams) =>
    apiClient
      .get<PaginatedResponse<Employee>>('/employees', { params })
      .then((r) => r.data),

  /** GET /employees/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<Employee>>(`/employees/${id}`)
      .then((r) => r.data.data),

  /** POST /employees */
  create: (data: CreateEmployeeDto) =>
    apiClient
      .post<BaseResponse<Employee>>('/employees', data)
      .then((r) => r.data.data),

  /** PATCH /employees/:id */
  update: (id: string, data: UpdateEmployeeDto) =>
    apiClient
      .patch<BaseResponse<Employee>>(`/employees/${id}`, data)
      .then((r) => r.data.data),

  /** GET /employees/headcount */
  getHeadcount: (branch?: string) =>
    apiClient
      .get<BaseResponse<Headcount>>('/employees/headcount', { params: { branch } })
      .then((r) => r.data.data),

  /** GET /employees/department/:deptCode */
  getByDepartment: (deptCode: string) =>
    apiClient
      .get<BaseResponse<Employee[]>>(`/employees/department/${deptCode}`)
      .then((r) => r.data.data),

  /** POST /employees/:id/deactivate */
  deactivate: (id: string, data: { reason?: string }) =>
    apiClient
      .post<BaseResponse<Employee>>(`/employees/${id}/deactivate`, data)
      .then((r) => r.data.data),
};
