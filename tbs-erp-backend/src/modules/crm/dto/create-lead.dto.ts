import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateLeadDto {
  @ApiProperty({ description: 'Ho ten lien he', example: 'Nguyen Van A' })
  @SanitizeHtmlStrict()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ description: 'Ten cong ty', example: 'Cong ty ABC' })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'So dien thoai', example: '0912345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email', example: 'lead@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Nguon tiem nang (source)',
    example: 'FACEBOOK',
    enum: ['WEBSITE', 'FACEBOOK', 'ZALO', 'REFERRAL', 'COLD_CALL', 'OTHER'],
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  source: string;

  @ApiPropertyOptional({ description: 'ID nhan vien sales duoc phan cong' })
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
