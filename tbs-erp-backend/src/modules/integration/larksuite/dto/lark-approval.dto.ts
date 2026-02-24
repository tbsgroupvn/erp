import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApprovalFormFieldDto {
  @ApiProperty({ description: 'Form field name/key' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Form field value' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class LarkApprovalDto {
  @ApiProperty({
    description: 'Approval definition code in LarkSuite',
    example: 'approval_xxxx',
  })
  @IsString()
  @IsNotEmpty()
  approvalCode: string;

  @ApiProperty({
    description: 'LarkSuite user ID of the approval initiator',
  })
  @IsString()
  @IsNotEmpty()
  initiatorUserId: string;

  @ApiProperty({
    description: 'Form data for the approval',
    type: [ApprovalFormFieldDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalFormFieldDto)
  formData: ApprovalFormFieldDto[];

  @ApiPropertyOptional({
    description: 'Specific approver user IDs (if not using the default approval flow)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverUserIds?: string[];

  @ApiPropertyOptional({
    description: 'CC user IDs to notify about the approval',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccUserIds?: string[];

  @ApiPropertyOptional({
    description: 'Additional comment from the initiator',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    description: 'ERP reference (e.g., voucher ID, order ID) to link this approval',
  })
  @IsOptional()
  @IsString()
  erpReference?: string;
}
