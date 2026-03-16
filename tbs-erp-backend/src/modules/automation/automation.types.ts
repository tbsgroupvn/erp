import { TriggerType, ActionType } from '@prisma/client';

export { TriggerType, ActionType };

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
  field: string;     // e.g. "order.totalAmount"
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_contains';
  value: string | number;
}

export interface ActionConfig {
  type: ActionType;
  params: {
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
    // UPDATE_FIELD + ASSIGN_USER
    entityType?: string;
    entityId?: string;
    field?: string;
    value?: string;
    // WEBHOOK_CALL
    url?: string;
    method?: string;
  };
}
