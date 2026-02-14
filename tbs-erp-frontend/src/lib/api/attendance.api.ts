import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse, QueryParams } from '@/lib/types';
import type { LeaveType, LeaveStatus } from '@/lib/types/enums';

// ============================================
// TYPES
// ============================================

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number;
  overtimeHours: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY';
  note: string | null;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  approverId: string | null;
  approverName: string | null;
  approvalId: string | null;
  createdAt: string;
}

export interface LeaveBalance {
  employeeId: string;
  annual: number;
  annualUsed: number;
  sick: number;
  sickUsed: number;
  personal: number;
  personalUsed: number;
}

export interface AttendanceSummary {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  averageWorkHours: number;
  overtimeHoursThisMonth: number;
}

export interface AttendanceQueryParams extends QueryParams {
  employeeId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export interface LeaveQueryParams extends QueryParams {
  employeeId?: string;
  status?: LeaveStatus;
  leaveType?: LeaveType;
}

export interface CreateLeaveRequestDto {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

// ============================================
// ATTENDANCE API
// ============================================

export const attendanceApi = {
  /** POST /attendance/check-in */
  checkIn: (data?: { note?: string }) =>
    apiClient
      .post<BaseResponse<AttendanceRecord>>('/attendance/check-in', data)
      .then((r) => r.data.data),

  /** POST /attendance/check-out */
  checkOut: (data?: { note?: string }) =>
    apiClient
      .post<BaseResponse<AttendanceRecord>>('/attendance/check-out', data)
      .then((r) => r.data.data),

  /** GET /attendance */
  list: (params?: AttendanceQueryParams) =>
    apiClient
      .get<PaginatedResponse<AttendanceRecord>>('/attendance', { params })
      .then((r) => r.data),

  /** GET /attendance/my */
  getMyAttendance: (params?: AttendanceQueryParams) =>
    apiClient
      .get<PaginatedResponse<AttendanceRecord>>('/attendance/my', { params })
      .then((r) => r.data),

  /** GET /attendance/summary */
  getSummary: (params?: { date?: string }) =>
    apiClient
      .get<BaseResponse<AttendanceSummary>>('/attendance/summary', { params })
      .then((r) => r.data.data),
};

// ============================================
// LEAVE API
// ============================================

export const leaveApi = {
  /** POST /attendance/leave-request */
  createRequest: (data: CreateLeaveRequestDto) =>
    apiClient
      .post<BaseResponse<LeaveRequest>>('/attendance/leave-request', data)
      .then((r) => r.data.data),

  /** GET /attendance/leave-requests */
  list: (params?: LeaveQueryParams) =>
    apiClient
      .get<PaginatedResponse<LeaveRequest>>('/attendance/leave-requests', { params })
      .then((r) => r.data),

  /** GET /attendance/leave-requests/my */
  getMyRequests: (params?: LeaveQueryParams) =>
    apiClient
      .get<PaginatedResponse<LeaveRequest>>('/attendance/leave-requests/my', { params })
      .then((r) => r.data),

  /** GET /attendance/leave-balance */
  getBalance: () =>
    apiClient
      .get<BaseResponse<LeaveBalance>>('/attendance/leave-balance')
      .then((r) => r.data.data),

  /** PATCH /attendance/leave-requests/:id/cancel */
  cancel: (id: string) =>
    apiClient
      .patch<BaseResponse<LeaveRequest>>(`/attendance/leave-requests/${id}/cancel`)
      .then((r) => r.data.data),
};
