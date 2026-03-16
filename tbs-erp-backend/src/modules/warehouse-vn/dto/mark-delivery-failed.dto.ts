import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum FailReason {
  KH_KHONG_CO_NHA = 'KH_KHONG_CO_NHA',
  KH_TU_CHOI = 'KH_TU_CHOI',
  DIA_CHI_SAI = 'DIA_CHI_SAI',
  KHAC = 'KHAC',
}

export class MarkDeliveryFailedDto {
  @ApiProperty({
    description: 'Ly do giao that bai',
    enum: FailReason,
    example: FailReason.KH_KHONG_CO_NHA,
  })
  @IsEnum(FailReason, { message: 'failReason phai la: KH_KHONG_CO_NHA, KH_TU_CHOI, DIA_CHI_SAI, KHAC' })
  @IsNotEmpty()
  failReason: FailReason;

  @ApiPropertyOptional({
    description: 'Chi tiet ly do giao that bai',
    example: 'KH khong nghe may, goi 3 lan khong duoc',
  })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'failNote phai co it nhat 5 ky tu' })
  failNote?: string;

  @ApiPropertyOptional({
    description: 'Anh bang chung giao that bai',
    example: ['https://storage.example.com/proof1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}
