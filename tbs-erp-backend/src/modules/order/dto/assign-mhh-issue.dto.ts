import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignMHHIssueDto {
  @ApiProperty({
    description: 'ID of the user to assign as handler for this issue',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Handler ID is required' })
  handlerId: string;
}
