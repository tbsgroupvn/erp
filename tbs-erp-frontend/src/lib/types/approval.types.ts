// ============================================
// APPROVAL TYPES — Multi-step approval workflow
// ============================================

import {
  ApprovalAction,
  ApprovalMode,
  ApprovalNodeType,
  ApprovalStatus,
  ApprovalType,
  ApproverType,
  UserRole,
} from './enums';

/** Full Approval entity */
export interface Approval {
  id: string;
  type: ApprovalType;
  referenceId: string;
  referenceCode: string | null;
  requestedBy: string;
  requestData: Record<string, unknown> | null;

  status: ApprovalStatus;
  currentStep: number;
  totalSteps: number;

  // Graph engine fields
  flowDefinitionId: string | null;
  currentNodeKey: string | null;
  isUrgent: boolean;
  deadline: string | null;

  createdAt: string;
  updatedAt: string;

  // Nested
  steps?: ApprovalStep[];
  ccUsers?: ApprovalCC[];
  comments?: ApprovalComment[];
  actionLogs?: ApprovalActionLog[];
}

/** Individual step within an approval flow */
export interface ApprovalStep {
  id: string;
  approvalId: string;
  stepNumber: number;
  approverRole: UserRole;
  approverId: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decidedAt: string | null;

  // Graph engine fields
  nodeId: string | null;
  assignedUserId: string | null;
  approvalMode: ApprovalMode | null;
  groupKey: string | null;
  delegatedFromUserId: string | null;
  deadlineAt: string | null;
  isOverdue: boolean;
}

/** CC user on an approval */
export interface ApprovalCC {
  id: string;
  approvalId: string;
  userId: string;
  nodeId: string | null;
  notifiedAt: string;
}

/** Comment on an approval */
export interface ApprovalComment {
  id: string;
  approvalId: string;
  userId: string;
  content: string;
  stepId: string | null;
  createdAt: string;
}

/** Action log entry */
export interface ApprovalActionLog {
  id: string;
  approvalId: string;
  userId: string;
  action: ApprovalAction;
  dataSnapshot: Record<string, unknown> | null;
  comment: string | null;
  delegateToUserId: string | null;
  addedStepId: string | null;
  createdAt: string;
}

/** Delegation record */
export interface ApprovalDelegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  approvalTypes: string[];
  startDate: string;
  endDate: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Flow definition */
export interface ApprovalFlowDefinition {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  triggerType: string;
  isActive: boolean;
  version: number;
  formSchema: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nodes?: ApprovalFlowNode[];
  edges?: ApprovalFlowEdge[];
  _count?: { nodes: number; edges: number; instances: number };
}

/** Flow node */
export interface ApprovalFlowNode {
  id: string;
  flowDefinitionId: string;
  nodeKey: string;
  nodeType: ApprovalNodeType;
  label: string | null;

  approverType: ApproverType | null;
  approverRole: UserRole | null;
  approverUserId: string | null;
  approvalMode: ApprovalMode | null;

  conditionField: string | null;
  conditionOperator: string | null;
  conditionValue: string | null;

  deadlineHours: number | null;
  autoAction: string | null;
  fieldPermissions: Record<string, string> | null;

  positionX: number | null;
  positionY: number | null;

  outgoingEdges?: ApprovalFlowEdge[];
  incomingEdges?: ApprovalFlowEdge[];
}

/** Flow edge */
export interface ApprovalFlowEdge {
  id: string;
  flowDefinitionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  conditionExpression: string | null;
  sortOrder: number;
}

/** Approval badge counts */
export interface ApprovalCounts {
  pendingForMe: number;
  mySubmitted: number;
  myProcessed: number;
  ccForMe: number;
}

/** DTO for creating an approval request */
export interface CreateApprovalDto {
  type: ApprovalType;
  referenceId: string;
  referenceCode?: string;
  requestData?: Record<string, unknown>;
  isUrgent?: boolean;
}

/** DTO for processing (approve / reject) an approval step */
export interface ProcessApprovalDto {
  action: 'APPROVED' | 'REJECTED';
  comment?: string;
}
