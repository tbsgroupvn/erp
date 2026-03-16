// ============================================
// ORDER PROJECT TYPES — Assignment, Handoff, SLA
// ============================================

export interface OrderAssignment {
  id: string;
  orderId: string;
  stage: string;
  departmentCode: string;
  assigneeId: string | null;
  assignee: { id: string; fullName: string } | null;
  assigneeRole: string;
  status: 'ACTIVE' | 'COMPLETED' | 'SKIPPED' | 'ESCALATED';
  assignedAt: string;
  completedAt: string | null;
  slaDeadline: string | null;
  isOverdue: boolean;
  autoTaskId: string | null;
}

export interface OrderHandoff {
  id: string;
  orderId: string;
  fromStage: string;
  toStage: string;
  fromDepartment: string;
  toDepartment: string;
  fromUserId: string | null;
  toUserId: string | null;
  toRole: string;
  handoffType: 'STAGE_TRANSITION' | 'REASSIGNMENT' | 'ESCALATION';
  note: string | null;
  durationMinutes: number | null;
  createdAt: string;
}

export interface OrderProjectSLA {
  isOverdue: boolean;
  percentElapsed: number;
  remainingMs: number | null;
}

export interface OrderProjectAutoTask {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string; fullName: string } | null;
  dueDate: string | null;
  orderStage: string | null;
  departmentCode: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface OrderProjectView {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  customer: { id: string; companyName: string } | null;
  assignments: OrderAssignment[];
  handoffs: OrderHandoff[];
  autoTasks: OrderProjectAutoTask[];
  sla: OrderProjectSLA;
}

export interface MyAssignment extends OrderAssignment {
  order: {
    id: string;
    code: string;
    status: string;
    saleId: string;
    customer: { id: string; companyName: string } | null;
  } | null;
}

export interface ReassignOrderDto {
  newAssigneeId: string;
  note?: string;
}
