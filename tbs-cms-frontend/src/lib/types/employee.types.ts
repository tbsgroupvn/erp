// ============================================
// EMPLOYEE TYPES — Employee, Headcount
// ============================================

import { Branch, EmployeeStatus } from './enums';

export interface Employee {
  id: string;
  code: string;
  userId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  departmentCode: string;
  positionTitle: string;
  branch: Branch;
  managerId?: string;
  manager?: Employee;
  subordinates?: Employee[];
  joinDate: string;
  salary?: number;
  bankAccount?: string;
  bankName?: string;
  taxCode?: string;
  insuranceId?: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  fullName: string;
  email?: string;
  phone?: string;
  departmentCode: string;
  positionTitle: string;
  branch: Branch;
  managerId?: string;
  joinDate: string;
  salary?: number;
  bankAccount?: string;
  bankName?: string;
  taxCode?: string;
  insuranceId?: string;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface EmployeeQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentCode?: string;
  branch?: Branch;
  status?: EmployeeStatus;
}

export interface Headcount {
  total: number;
  byDepartment: Record<string, number>;
  byBranch: Record<string, number>;
  byStatus: Record<string, number>;
}
