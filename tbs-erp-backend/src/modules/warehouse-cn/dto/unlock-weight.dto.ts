import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnlockWeightDto {
  @ApiProperty({
    description: 'Ly do mo khoa can nang (toi thieu 10 ky tu)',
    example: 'Can nang bi sai, can do lai theo yeu cau quan ly kho',
  })
  @IsString()
  @MinLength(10, { message: 'Ly do phai co it nhat 10 ky tu' })
  reason: string;
}
