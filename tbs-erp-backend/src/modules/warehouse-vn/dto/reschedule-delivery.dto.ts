import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RescheduleDeliveryDto {
  @ApiProperty({
    description: 'Ngay giao lai (ISO date, phai la tuong lai)',
    example: '2026-03-07',
  })
  @IsDateString({}, { message: 'scheduledDate phai la ngay hop le (ISO format)' })
  @IsNotEmpty()
  scheduledDate: string;

  @ApiPropertyOptional({
    description: 'Ghi chu khi len lich giao lai',
    example: 'KH yeu cau giao buoi chieu',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'ID tai xe moi (neu thay doi)',
  })
  @IsOptional()
  @IsString()
  driverId?: string;
}
