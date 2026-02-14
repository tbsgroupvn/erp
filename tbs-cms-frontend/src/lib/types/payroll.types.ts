import type { QueryParams } from './common.types';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  grossSalary: number;
  taxDeduction: number;
  insuranceDeduction: number;
  otherDeductions: number;
  netSalary: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollSummary {
  month: number;
  year: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
}

export interface PayrollQueryParams extends QueryParams {
  month?: number;
  year?: number;
  status?: string;
}
