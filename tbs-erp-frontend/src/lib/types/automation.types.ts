// ============================================
// AUTOMATION TYPES
// ============================================

export type AutomationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

export type TriggerType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'COMPLAINT_OPENED'
  | 'TASK_OVERDUE'
  | 'APPROVAL_COMPLETED'
  | 'SCHEDULE_DAILY'
  | 'SCHEDULE_WEEKLY'
  | 'MANUAL';

export type ActionType =
  | 'SEND_NOTIFICATION'
  | 'CREATE_TASK'
  | 'SEND_EMAIL'
  | 'UPDATE_FIELD'
  | 'WEBHOOK_CALL'
  | 'ASSIGN_USER';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'contains'
  | 'not_contains';

// ---------------------------------------------------------------------------
// Configs (mirrors backend)
// ---------------------------------------------------------------------------

export interface TriggerConfig {
  type: TriggerType;
  params?: {
    statusFrom?: string;
    statusTo?: string;
    scheduleTime?: string; // HH:MM
    scheduleDay?: number;  // 1-7 for weekly
  };
}

export interface ConditionConfig {
  field: string;
  operator: ConditionOperator;
  value: string | number;
}

export interface ActionParams {
  // SEND_NOTIFICATION
  userId?: string;
  userRole?: string;
  message?: string;
  // CREATE_TASK
  title?: string;
  assigneeId?: string;
  priority?: string;
  dueInDays?: number;
  // SEND_EMAIL
  to?: string;
  subject?: string;
  body?: string;
  // UPDATE_FIELD
  entityType?: string;
  field?: string;
  value?: string;
  // WEBHOOK_CALL
  url?: string;
  method?: string;
}

export interface ActionConfig {
  type: ActionType;
  params: ActionParams;
}

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  createdBy: string;
  runCount: number;
  lastRunAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
  executions?: AutomationExecution[];
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  triggeredBy?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  input?: Record<string, any>;
  output?: Record<string, any>;
  errorMsg?: string;
  executedAt: string;
  durationMs?: number;
}

export interface AutomationStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateAutomationRuleDto {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  conditions?: ConditionConfig[];
  actions: ActionConfig[];
}

export interface UpdateAutomationRuleDto {
  name?: string;
  description?: string;
  status?: AutomationStatus;
  trigger?: TriggerConfig;
  conditions?: ConditionConfig[];
  actions?: ActionConfig[];
}

// ---------------------------------------------------------------------------
// UI Catalog helpers
// ---------------------------------------------------------------------------

export interface TriggerMeta {
  type: TriggerType;
  label: string;
  description: string;
  icon: string;
  category: 'order' | 'finance' | 'complaint' | 'task' | 'approval' | 'schedule';
  fields: FieldMeta[];
}

export interface ActionMeta {
  type: ActionType;
  label: string;
  description: string;
  icon: string;
}

export interface FieldMeta {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}

export const TRIGGER_CATALOG: TriggerMeta[] = [
  {
    type: 'ORDER_CREATED',
    label: 'Đơn hàng mới',
    description: 'Khi có đơn hàng được tạo',
    icon: 'ShoppingCart',
    category: 'order',
    fields: [
      { key: 'order.serviceType', label: 'Loại dịch vụ', type: 'select', options: [
        { value: 'AIR', label: 'Hàng không' },
        { value: 'SEA', label: 'Đường biển' },
        { value: 'LAND', label: 'Đường bộ' },
      ]},
      { key: 'order.totalAmount', label: 'Tổng tiền', type: 'number' },
      { key: 'order.customerTier', label: 'Hạng khách', type: 'select', options: [
        { value: 'STANDARD', label: 'Thường' },
        { value: 'SILVER', label: 'Bạc' },
        { value: 'GOLD', label: 'Vàng' },
        { value: 'PLATINUM', label: 'Bạch kim' },
      ]},
    ],
  },
  {
    type: 'ORDER_STATUS_CHANGED',
    label: 'Trạng thái đơn thay đổi',
    description: 'Khi đơn hàng chuyển sang trạng thái mới',
    icon: 'RefreshCw',
    category: 'order',
    fields: [
      { key: 'order.status', label: 'Trạng thái', type: 'text' },
      { key: 'order.totalAmount', label: 'Tổng tiền', type: 'number' },
    ],
  },
  {
    type: 'PAYMENT_RECEIVED',
    label: 'Nhận thanh toán',
    description: 'Khi ghi nhận thanh toán từ khách hàng',
    icon: 'CreditCard',
    category: 'finance',
    fields: [
      { key: 'payment.amount', label: 'Số tiền', type: 'number' },
      { key: 'payment.method', label: 'Phương thức', type: 'text' },
    ],
  },
  {
    type: 'COMPLAINT_OPENED',
    label: 'Khiếu nại mới',
    description: 'Khi có khiếu nại được mở',
    icon: 'AlertTriangle',
    category: 'complaint',
    fields: [
      { key: 'complaint.severity', label: 'Mức độ', type: 'select', options: [
        { value: 'LOW', label: 'Thấp' },
        { value: 'MEDIUM', label: 'Trung bình' },
        { value: 'HIGH', label: 'Cao' },
        { value: 'CRITICAL', label: 'Nghiêm trọng' },
      ]},
      { key: 'complaint.type', label: 'Loại khiếu nại', type: 'text' },
    ],
  },
  {
    type: 'TASK_OVERDUE',
    label: 'Công việc quá hạn',
    description: 'Khi công việc vượt quá ngày hạn',
    icon: 'Clock',
    category: 'task',
    fields: [
      { key: 'task.priority', label: 'Ưu tiên', type: 'select', options: [
        { value: 'LOW', label: 'Thấp' },
        { value: 'MEDIUM', label: 'Trung bình' },
        { value: 'HIGH', label: 'Cao' },
        { value: 'URGENT', label: 'Khẩn cấp' },
      ]},
      { key: 'task.assigneeId', label: 'Người thực hiện', type: 'text' },
    ],
  },
  {
    type: 'APPROVAL_COMPLETED',
    label: 'Phê duyệt hoàn thành',
    description: 'Khi quy trình phê duyệt kết thúc',
    icon: 'CheckCircle',
    category: 'approval',
    fields: [
      { key: 'approval.status', label: 'Kết quả', type: 'select', options: [
        { value: 'APPROVED', label: 'Đã duyệt' },
        { value: 'REJECTED', label: 'Từ chối' },
      ]},
      { key: 'approval.type', label: 'Loại phê duyệt', type: 'text' },
    ],
  },
  {
    type: 'SCHEDULE_DAILY',
    label: 'Hàng ngày',
    description: 'Chạy tự động mỗi ngày theo lịch',
    icon: 'Calendar',
    category: 'schedule',
    fields: [],
  },
  {
    type: 'SCHEDULE_WEEKLY',
    label: 'Hàng tuần',
    description: 'Chạy tự động mỗi tuần theo lịch',
    icon: 'CalendarDays',
    category: 'schedule',
    fields: [],
  },
  {
    type: 'MANUAL',
    label: 'Thủ công',
    description: 'Kích hoạt bằng tay',
    icon: 'Play',
    category: 'schedule',
    fields: [],
  },
];

export const ACTION_CATALOG: ActionMeta[] = [
  {
    type: 'SEND_NOTIFICATION',
    label: 'Gửi thông báo',
    description: 'Gửi thông báo in-app tới người dùng',
    icon: 'Bell',
  },
  {
    type: 'CREATE_TASK',
    label: 'Tạo công việc',
    description: 'Tự động tạo task và giao cho người thực hiện',
    icon: 'ClipboardList',
  },
  {
    type: 'SEND_EMAIL',
    label: 'Gửi email',
    description: 'Gửi email tới địa chỉ chỉ định',
    icon: 'Mail',
  },
  {
    type: 'WEBHOOK_CALL',
    label: 'Gọi Webhook',
    description: 'Gửi HTTP request tới URL bên ngoài',
    icon: 'Globe',
  },
  {
    type: 'UPDATE_FIELD',
    label: 'Cập nhật trường',
    description: 'Cập nhật giá trị trường dữ liệu',
    icon: 'Edit',
  },
  {
    type: 'ASSIGN_USER',
    label: 'Giao người xử lý',
    description: 'Gán người dùng vào đối tượng',
    icon: 'UserCheck',
  },
];

export const TRIGGER_CATEGORY_LABELS: Record<TriggerMeta['category'], string> = {
  order: 'Đơn hàng',
  finance: 'Tài chính',
  complaint: 'Khiếu nại',
  task: 'Công việc',
  approval: 'Phê duyệt',
  schedule: 'Lịch trình',
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'bằng',
  neq: 'khác',
  gt: 'lớn hơn',
  lt: 'nhỏ hơn',
  contains: 'chứa',
  not_contains: 'không chứa',
};
