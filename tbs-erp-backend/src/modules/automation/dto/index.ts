import { IsString, IsOptional, IsEnum, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutomationStatus } from '@prisma/client';

export class CreateAutomationRuleDto {
  @ApiProperty({ description: 'Rule name', example: 'Notify when order created' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Trigger configuration object', type: Object })
  @IsObject()
  trigger: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Condition list (AND logic)',
    type: Array,
    example: [{ field: 'order.totalAmount', operator: 'gt', value: 1000000 }],
  })
  @IsOptional()
  @IsArray()
  conditions?: Record<string, any>[];

  @ApiProperty({
    description: 'Action list (sequential execution)',
    type: Array,
    example: [{ type: 'SEND_NOTIFICATION', params: { message: 'New order {{order.code}}' } }],
  })
  @IsArray()
  actions: Record<string, any>[];
}

export class UpdateAutomationRuleDto {
  @ApiPropertyOptional({ description: 'Rule name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: AutomationStatus })
  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;

  @ApiPropertyOptional({ description: 'Trigger configuration object', type: Object })
  @IsOptional()
  @IsObject()
  trigger?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Condition list', type: Array })
  @IsOptional()
  @IsArray()
  conditions?: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Action list', type: Array })
  @IsOptional()
  @IsArray()
  actions?: Record<string, any>[];
}
