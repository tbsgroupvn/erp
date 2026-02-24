import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MHHIssueStatus } from '@prisma/client';

export class UpdateMHHIssueStatusDto {
  @ApiProperty({
    description: 'New status for the MHH issue',
    enum: MHHIssueStatus,
    example: MHHIssueStatus.INVESTIGATING,
  })
  @IsEnum(MHHIssueStatus, { message: 'Invalid MHH issue status' })
  status: MHHIssueStatus;

  @ApiPropertyOptional({
    description: 'Optional note explaining the status change',
    example: 'Contacted supplier for more information',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
