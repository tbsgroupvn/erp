import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  ArrayMaxSize,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalMode, ApprovalNodeType, ApproverType, UserRole } from '@prisma/client';

export class FlowNodeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nodeKey: string;

  @ApiProperty({ enum: ApprovalNodeType })
  @IsNotEmpty()
  @IsEnum(ApprovalNodeType)
  nodeType: ApprovalNodeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional({ enum: ApproverType })
  @IsOptional()
  @IsEnum(ApproverType)
  approverType?: ApproverType;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  approverRole?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  approverUserId?: string;

  @ApiPropertyOptional({ enum: ApprovalMode })
  @IsOptional()
  @IsEnum(ApprovalMode)
  approvalMode?: ApprovalMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  conditionField?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  conditionOperator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deadlineHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  autoAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  fieldPermissions?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  positionX?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  positionY?: number;
}

export class FlowEdgeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sourceNodeKey: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  targetNodeKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionExpression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateFlowDefinitionDto {
  @ApiProperty({ description: 'Flow name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Flow description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Category: SALES, FINANCE, HR, LOGISTICS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ description: 'Trigger type (ApprovalType value)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  triggerType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  formSchema?: Record<string, unknown>;

  @ApiProperty({ type: [FlowNodeDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FlowNodeDto)
  nodes: FlowNodeDto[];

  @ApiProperty({ type: [FlowEdgeDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => FlowEdgeDto)
  edges: FlowEdgeDto[];
}
