import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { UserRole } from '@prisma/client';

export class AddApproverDto {
  @ApiProperty({ description: 'Insert after this step number' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  afterStepNumber: number;

  @ApiProperty({ description: 'Approver role', enum: UserRole })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Specific user ID' })
  @IsOptional()
  @IsString()
  userId?: string;
}
