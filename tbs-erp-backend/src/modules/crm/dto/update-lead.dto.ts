import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class UpdateLeadDto {
  @ApiPropertyOptional({ description: 'Ho ten lien he' })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Ten cong ty' })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'So dien thoai' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Trang thai lead',
    enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional({ description: 'Nguon tiem nang' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @ApiPropertyOptional({ description: 'ID nhan vien sales duoc phan cong' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Ghi chu them' })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  note?: string;
}
