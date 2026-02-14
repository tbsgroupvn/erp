import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MaintenanceType } from '@prisma/client';

export class ScheduleMaintenanceDto {
  @ApiProperty({ description: 'Maintenance type', enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ description: 'Scheduled date', example: '2025-07-01' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteMaintenanceDto {
  @ApiPropertyOptional({ description: 'Maintenance cost', example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Next due date', example: '2025-10-01' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;
}

export class RecordFuelDto {
  @ApiProperty({ description: 'Fuel date', example: '2025-06-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Liters of fuel', example: 50 })
  @IsNumber()
  @Min(0)
  liters: number;

  @ApiProperty({ description: 'Total cost', example: 1200000 })
  @IsNumber()
  @Min(0)
  cost: number;

  @ApiPropertyOptional({ description: 'Odometer reading in km', example: 45000 })
  @IsOptional()
  @IsNumber()
  odometer?: number;
}
