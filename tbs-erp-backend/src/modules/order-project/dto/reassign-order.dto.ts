import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for reassigning an order's active assignment to a new user.
 */
export class ReassignOrderDto {
  @ApiProperty({
    description: 'The ID of the user to assign this order stage to',
    example: 'clxyz123456',
  })
  @IsString()
  @IsNotEmpty()
  newAssigneeId: string;

  @ApiPropertyOptional({
    description: 'Optional note explaining the reason for reassignment',
    example: 'User on leave — handing over to backup',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
