import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RetentionPolicyDto {
  @ApiProperty({ description: 'Entity name (e.g. AuditLog, Session, Order)' })
  entity: string;

  @ApiProperty({ description: 'Number of days to retain data before action is taken' })
  retentionDays: number;

  @ApiProperty({ description: 'Action to perform: archive or delete', enum: ['archive', 'delete'] })
  action: 'archive' | 'delete';

  @ApiProperty({ description: 'Human-readable description of the policy' })
  description: string;

  @ApiPropertyOptional({ description: 'Legal basis for the retention period' })
  legalBasis?: string;
}

export class RetentionReportDto {
  @ApiProperty({ description: 'Report ID' })
  id: string;

  @ApiProperty({ description: 'When the retention policy was executed' })
  executedAt: Date;

  @ApiPropertyOptional({ description: 'User ID who triggered execution (null = automated)' })
  executedBy: string | null;

  @ApiProperty({ description: 'Trigger type: SCHEDULED or MANUAL' })
  trigger: string;

  @ApiProperty({ description: 'Number of audit logs archived' })
  auditLogsArchived: number;

  @ApiProperty({ description: 'Number of expired sessions deleted' })
  sessionsDeleted: number;

  @ApiProperty({ description: 'Number of old orders archived' })
  ordersArchived: number;

  @ApiProperty({ description: 'Number of temp files cleaned' })
  tempFilesDeleted: number;

  @ApiProperty({ description: 'Number of old notifications deleted' })
  notificationsDeleted: number;

  @ApiProperty({ description: 'Number of expired tokens deleted' })
  tokensDeleted: number;

  @ApiProperty({ description: 'Number of deleted users anonymized' })
  usersAnonymized: number;

  @ApiProperty({ description: 'Execution duration in milliseconds' })
  durationMs: number;

  @ApiPropertyOptional({ description: 'Error messages if any' })
  errors: string | null;
}

export class UserDataExportDto {
  @ApiProperty({ description: 'User profile data' })
  profile: Record<string, any>;

  @ApiProperty({ description: 'User sessions' })
  sessions: Record<string, any>[];

  @ApiProperty({ description: 'User audit logs' })
  auditLogs: Record<string, any>[];

  @ApiProperty({ description: 'User consents' })
  consents: Record<string, any>[];

  @ApiProperty({ description: 'Orders associated with user' })
  orders: Record<string, any>[];

  @ApiProperty({ description: 'Tasks assigned to user' })
  tasks: Record<string, any>[];

  @ApiProperty({ description: 'Notifications' })
  notifications: Record<string, any>[];

  @ApiProperty({ description: 'Export metadata' })
  metadata: {
    exportedAt: string;
    exportedBy: string;
    format: string;
    totalRecords: number;
  };
}

export class AnonymizeUserDto {
  @ApiProperty({ description: 'Reason for anonymization (required for audit trail)' })
  reason: string;
}

export class ExecuteRetentionDto {
  @ApiPropertyOptional({ description: 'Only execute specific policies by entity name' })
  entities?: string[];
}
