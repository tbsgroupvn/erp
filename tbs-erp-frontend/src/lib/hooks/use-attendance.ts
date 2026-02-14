'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  attendanceApi,
  leaveApi,
  type AttendanceQueryParams,
  type LeaveQueryParams,
  type CreateLeaveRequestDto,
} from '@/lib/api/attendance.api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (params?: AttendanceQueryParams) => [...attendanceKeys.lists(), params] as const,
  my: (params?: AttendanceQueryParams) => [...attendanceKeys.all, 'my', params] as const,
  summary: (date?: string) => [...attendanceKeys.all, 'summary', date] as const,
};

export const leaveKeys = {
  all: ['leave'] as const,
  lists: () => [...leaveKeys.all, 'list'] as const,
  list: (params?: LeaveQueryParams) => [...leaveKeys.lists(), params] as const,
  my: (params?: LeaveQueryParams) => [...leaveKeys.all, 'my', params] as const,
  balance: () => [...leaveKeys.all, 'balance'] as const,
};

// ---------------------------------------------------------------------------
// Attendance Queries
// ---------------------------------------------------------------------------

export function useAttendanceList(params?: AttendanceQueryParams) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: () => attendanceApi.list(params),
  });
}

export function useMyAttendance(params?: AttendanceQueryParams) {
  return useQuery({
    queryKey: attendanceKeys.my(params),
    queryFn: () => attendanceApi.getMyAttendance(params),
  });
}

export function useAttendanceSummary(date?: string) {
  return useQuery({
    queryKey: attendanceKeys.summary(date),
    queryFn: () => attendanceApi.getSummary(date ? { date } : undefined),
  });
}

// ---------------------------------------------------------------------------
// Attendance Mutations
// ---------------------------------------------------------------------------

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => attendanceApi.checkIn(note ? { note } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success('Đã chấm công vào');
    },
    onError: () => {
      toast.error('Không thể chấm công vào');
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => attendanceApi.checkOut(note ? { note } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success('Đã chấm công ra');
    },
    onError: () => {
      toast.error('Không thể chấm công ra');
    },
  });
}

// ---------------------------------------------------------------------------
// Leave Queries
// ---------------------------------------------------------------------------

export function useLeaveRequests(params?: LeaveQueryParams) {
  return useQuery({
    queryKey: leaveKeys.list(params),
    queryFn: () => leaveApi.list(params),
  });
}

export function useMyLeaveRequests(params?: LeaveQueryParams) {
  return useQuery({
    queryKey: leaveKeys.my(params),
    queryFn: () => leaveApi.getMyRequests(params),
  });
}

export function useLeaveBalance() {
  return useQuery({
    queryKey: leaveKeys.balance(),
    queryFn: () => leaveApi.getBalance(),
  });
}

// ---------------------------------------------------------------------------
// Leave Mutations
// ---------------------------------------------------------------------------

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveRequestDto) => leaveApi.createRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success('Đã gửi yêu cầu nghỉ phép');
    },
    onError: () => {
      toast.error('Không thể gửi yêu cầu nghỉ phép');
    },
  });
}

export function useCancelLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.all });
      toast.success('Đã hủy yêu cầu nghỉ phép');
    },
    onError: () => {
      toast.error('Không thể hủy yêu cầu nghỉ phép');
    },
  });
}
