import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum StatementType {
  BALANCE_SHEET = 'BALANCE_SHEET',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
  CASH_FLOW = 'CASH_FLOW',
  TRIAL_BALANCE = 'TRIAL_BALANCE',
  GENERAL_LEDGER = 'GENERAL_LEDGER',
}

export enum ExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
}

export class FinancialStatementDto {
  @ApiProperty({
    description: 'Type of financial statement to export',
    enum: StatementType,
    example: StatementType.BALANCE_SHEET,
  })
  @IsEnum(StatementType)
  statementType: StatementType;

  @ApiProperty({
    description: 'Start date for the reporting period (ISO 8601)',
    example: '2025-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the reporting period (ISO 8601)',
    example: '2025-12-31',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ExportFormat,
    default: ExportFormat.EXCEL,
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.EXCEL;

  @ApiPropertyOptional({
    description: 'Currency for the report',
    default: 'VND',
    example: 'VND',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'VND';

  @ApiPropertyOptional({
    description: 'Specific department or branch code to filter by',
  })
  @IsOptional()
  @IsString()
  departmentCode?: string;

  @ApiPropertyOptional({
    description: 'Whether to include comparative data from the previous period',
  })
  @IsOptional()
  includeComparative?: boolean = false;
}
