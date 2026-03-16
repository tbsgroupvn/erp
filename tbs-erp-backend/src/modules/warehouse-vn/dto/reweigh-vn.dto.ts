import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReweighVNDto {
  @ApiProperty({
    description: 'Can nang do tai kho VN (kg)',
    example: 5.5,
  })
  @IsNumber()
  @Min(0.01, { message: 'Can nang phai lon hon 0' })
  vnWeight: number;
}
