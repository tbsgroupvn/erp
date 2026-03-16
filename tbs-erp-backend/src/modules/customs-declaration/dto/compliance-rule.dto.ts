import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

export enum ComplianceRuleType {
  RESTRICTED = 'RESTRICTED',
  PROHIBITED = 'PROHIBITED',
  PERMIT_REQUIRED = 'PERMIT_REQUIRED',
}

export class CreateComplianceRuleDto {
  @ApiProperty({
    description: 'HS code pattern to match (supports wildcards, e.g., "8471.*")',
    example: '8471.*',
  })
  @IsNotEmpty({ message: 'HS code pattern is required' })
  @IsString()
  hsCodePattern: string;

  @ApiProperty({
    description: 'Type of compliance rule',
    enum: ComplianceRuleType,
    example: ComplianceRuleType.PERMIT_REQUIRED,
  })
  @IsNotEmpty({ message: 'Rule type is required' })
  @IsEnum(ComplianceRuleType, {
    message: 'Rule type must be RESTRICTED, PROHIBITED, or PERMIT_REQUIRED',
  })
  ruleType: string;

  @ApiPropertyOptional({
    description: 'Required permit type (if rule type is PERMIT_REQUIRED)',
    example: 'IMPORT_LICENSE',
  })
  @IsOptional()
  @IsString()
  permitType?: string;

  @ApiProperty({
    description: 'Human-readable message describing the rule',
    example: 'Computer equipment requires import license from BKHCN',
  })
  @IsNotEmpty({ message: 'Message is required' })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Regulatory authority that issued the rule',
    example: 'BKHCN',
  })
  @IsOptional()
  @IsString()
  authority?: string;
}

export class UpdateComplianceRuleDto {
  @ApiPropertyOptional({
    description: 'HS code pattern to match',
    example: '8471.*',
  })
  @IsOptional()
  @IsString()
  hsCodePattern?: string;

  @ApiPropertyOptional({
    description: 'Type of compliance rule',
    enum: ComplianceRuleType,
  })
  @IsOptional()
  @IsEnum(ComplianceRuleType, {
    message: 'Rule type must be RESTRICTED, PROHIBITED, or PERMIT_REQUIRED',
  })
  ruleType?: string;

  @ApiPropertyOptional({
    description: 'Required permit type',
  })
  @IsOptional()
  @IsString()
  permitType?: string;

  @ApiPropertyOptional({
    description: 'Human-readable message describing the rule',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Regulatory authority that issued the rule',
  })
  @IsOptional()
  @IsString()
  authority?: string;
}
