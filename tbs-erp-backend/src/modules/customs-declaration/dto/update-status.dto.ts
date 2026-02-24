import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CustomsDeclarationStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New status for the customs declaration',
    enum: CustomsDeclarationStatus,
    example: CustomsDeclarationStatus.READY,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(CustomsDeclarationStatus, { message: 'Invalid customs declaration status' })
  status: CustomsDeclarationStatus;

  @ApiPropertyOptional({
    description: 'Note explaining the status change',
    example: 'All lines verified and ready for submission',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
