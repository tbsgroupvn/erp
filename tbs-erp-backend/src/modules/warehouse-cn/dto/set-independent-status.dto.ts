import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PackageIndependentStatus {
  NORMAL = 'NORMAL',
  CONFISCATED_BY_CUSTOMS = 'CONFISCATED_BY_CUSTOMS',
  HIGH_RISK_HOLD = 'HIGH_RISK_HOLD',
}

export class SetIndependentStatusDto {
  @ApiProperty({
    description: 'Trang thai doc lap cua kien hang',
    enum: PackageIndependentStatus,
    example: PackageIndependentStatus.HIGH_RISK_HOLD,
  })
  @IsEnum(PackageIndependentStatus)
  status: PackageIndependentStatus;

  @ApiPropertyOptional({ description: 'Ly do thay doi trang thai', example: 'Phat hien hang cam' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
