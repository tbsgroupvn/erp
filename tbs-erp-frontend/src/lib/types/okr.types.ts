// ============================================
// OKR — Objectives & Key Results Types
// ============================================

export type OKRPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'ANNUAL';
export type OKRLevel = 'COMPANY' | 'DEPARTMENT' | 'INDIVIDUAL';
export type OKRStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type KeyResultStatus = 'NOT_STARTED' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED';
export type MetricType = 'PERCENTAGE' | 'NUMBER' | 'BOOLEAN' | 'CURRENCY';

export interface OKRCheckIn {
  id: string;
  keyResultId: string;
  value: number;
  note?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface OKRTaskLink {
  id: string;
  keyResultId: string;
  taskId: string;
  createdAt: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description?: string | null;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  unit?: string | null;
  status: KeyResultStatus;
  ownerId: string;
  dueDate?: string | null;
  checkIns?: OKRCheckIn[];
  linkedTasks?: OKRTaskLink[];
  createdAt: string;
  updatedAt: string;
  // computed
  progress?: number;
}

export interface ObjectiveParent {
  id: string;
  title: string;
  level: OKRLevel;
  status?: OKRStatus;
}

export interface ObjectiveChild {
  id: string;
  title: string;
  level: OKRLevel;
  status: OKRStatus;
  keyResults?: KeyResult[];
  children?: ObjectiveChild[];
  progress?: number;
}

export interface Objective {
  id: string;
  title: string;
  description?: string | null;
  period: OKRPeriod;
  year: number;
  level: OKRLevel;
  status: OKRStatus;
  ownerId: string;
  department?: string | null;
  parentId?: string | null;
  parent?: ObjectiveParent | null;
  children?: ObjectiveChild[];
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // computed
  progress: number;
}

// DTOs
export interface CreateObjectiveDto {
  title: string;
  description?: string;
  period: OKRPeriod;
  year: number;
  level: OKRLevel;
  department?: string;
  parentId?: string;
}

export interface UpdateObjectiveDto {
  title?: string;
  description?: string;
  status?: OKRStatus;
}

export interface CreateKeyResultDto {
  title: string;
  description?: string;
  metricType: MetricType;
  targetValue: number;
  unit?: string;
  dueDate?: string;
}

export interface UpdateKeyResultDto {
  title?: string;
  description?: string;
  targetValue?: number;
  unit?: string;
  status?: KeyResultStatus;
  dueDate?: string;
}

export interface CheckInDto {
  value: number;
  note?: string;
}

export interface OKRQueryParams {
  period?: OKRPeriod;
  year?: number;
  level?: OKRLevel;
  ownerId?: string;
  status?: OKRStatus;
}

// Dashboard
export interface OKRTopPerformer {
  ownerId: string;
  avgProgress: number;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface OKRAtRiskKeyResult {
  id: string;
  title: string;
  status: KeyResultStatus;
  currentValue: number;
  targetValue: number;
  unit?: string | null;
  objective: {
    id: string;
    title: string;
    ownerId: string;
  };
}

export interface OKRDashboard {
  myObjectivesCount: number;
  myAvgProgress: number;
  atRiskCount: number;
  completedCount: number;
  atRiskKeyResults: OKRAtRiskKeyResult[];
  topPerformers: OKRTopPerformer[];
}

export interface ParentCandidate {
  id: string;
  title: string;
  level: OKRLevel;
  department?: string | null;
}

// Label maps
export const OKR_PERIOD_LABELS: Record<OKRPeriod, string> = {
  Q1: 'Quy 1 (Q1)',
  Q2: 'Quy 2 (Q2)',
  Q3: 'Quy 3 (Q3)',
  Q4: 'Quy 4 (Q4)',
  ANNUAL: 'Ca nam',
};

export const OKR_LEVEL_LABELS: Record<OKRLevel, string> = {
  COMPANY: 'Cong ty',
  DEPARTMENT: 'Phong ban',
  INDIVIDUAL: 'Ca nhan',
};

export const OKR_STATUS_LABELS: Record<OKRStatus, string> = {
  DRAFT: 'Nhap',
  ACTIVE: 'Dang hoat dong',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Da huy',
};

export const KR_STATUS_LABELS: Record<KeyResultStatus, string> = {
  NOT_STARTED: 'Chua bat dau',
  ON_TRACK: 'Dung ke hoach',
  AT_RISK: 'Co rui ro',
  BEHIND: 'Cham tien do',
  COMPLETED: 'Hoan thanh',
};

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  PERCENTAGE: 'Phan tram (%)',
  NUMBER: 'So luong',
  BOOLEAN: 'Co/Khong',
  CURRENCY: 'Tien te (VND)',
};
