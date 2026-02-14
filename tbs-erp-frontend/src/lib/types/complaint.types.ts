// ============================================
// COMPLAINT TYPES — Complaint, ComplaintStatistics
// ============================================

import { ComplaintType, ComplaintSeverity, ComplaintStatus, ResolutionType } from './enums';

export interface Complaint {
  id: string;
  code: string;
  orderId?: string;
  order?: { id: string; code: string };
  customerId: string;
  customer?: { id: string; fullName: string; code: string };
  type: ComplaintType;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  description: string;
  attachments: string[];
  handlerId?: string;
  handler?: { id: string; fullName: string };
  resolutionType?: ResolutionType;
  resolutionAmount?: number;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplaintDto {
  orderId?: string;
  customerId: string;
  type: ComplaintType;
  severity: ComplaintSeverity;
  description: string;
  attachments?: string[];
}

export interface ResolveComplaintDto {
  resolutionType: ResolutionType;
  resolutionAmount?: number;
  resolutionNotes: string;
}

export interface ComplaintQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ComplaintStatus;
  type?: ComplaintType;
  severity?: ComplaintSeverity;
  customerId?: string;
}

export interface ComplaintStatistics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  avgResolutionTime?: number;
  totalCompensation: number;
}
