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
// GPS TYPES
// ============================================

export interface GpsCheckInDto {
  latitude: number;
  longitude: number;
  method?: 'GPS' | 'WIFI' | 'MANUAL';
  type?: 'OFFICE' | 'REMOTE' | 'FIELD';
}

export interface GpsCheckOutDto {
  latitude: number;
  longitude: number;
  method?: 'GPS' | 'WIFI' | 'MANUAL';
}

export interface GpsValidationResult {
  isValid: boolean;
  officeName?: string;
  distance?: number;
}

export interface GpsCheckInResponse {
  attendance: AttendanceRecord;
  gpsValidation: GpsValidationResult;
}

export interface OfficeLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  wifiSSID: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceLocationRecord {
  id: string;
  attendanceId: string;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAddress: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAddress: string | null;
  checkInMethod: string;
  checkOutMethod: string | null;
  createdAt: string;
}

export interface MapData {
  locations: AttendanceLocationRecord[];
  offices: OfficeLocation[];
}

export interface CreateOfficeLocationDto {
  name: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  wifiSSID?: string;
}

// ============================================
// GPS ATTENDANCE API
// ============================================

export const attendanceGpsApi = {
  /** POST /attendance/check-in-gps */
  checkInGps: (data: GpsCheckInDto) =>
    apiClient
      .post<BaseResponse<GpsCheckInResponse>>('/attendance/check-in-gps', data)
      .then((r) => r.data.data),

  /** POST /attendance/check-out-gps */
  checkOutGps: (data: GpsCheckOutDto) =>
    apiClient
      .post<BaseResponse<AttendanceRecord>>('/attendance/check-out-gps', data)
      .then((r) => r.data.data),

  /** GET /attendance/offices */
  getOffices: () =>
    apiClient
      .get<BaseResponse<OfficeLocation[]>>('/attendance/offices')
      .then((r) => r.data.data),

  /** POST /attendance/offices */
  createOffice: (data: CreateOfficeLocationDto) =>
    apiClient
      .post<BaseResponse<OfficeLocation>>('/attendance/offices', data)
      .then((r) => r.data.data),

  /** GET /attendance/map */
  getMapData: (date?: string) =>
    apiClient
      .get<BaseResponse<MapData>>('/attendance/map', { params: date ? { date } : undefined })
      .then((r) => r.data.data),

  /** GET /attendance/validate-gps */
  validateGps: (lat: number, lng: number) =>
    apiClient
      .get<BaseResponse<GpsValidationResult>>('/attendance/validate-gps', {
        params: { lat, lng },
      })
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
