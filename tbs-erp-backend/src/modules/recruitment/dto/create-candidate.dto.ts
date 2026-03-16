import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export enum CandidateSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  JOB_BOARD = 'JOB_BOARD',
  LINKEDIN = 'LINKEDIN',
  HEADHUNT = 'HEADHUNT',
}

export class CreateCandidateDto {
  @ApiProperty({ description: 'Họ và tên ứng viên', example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ description: 'Email ứng viên', example: 'nguyenvana@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: 'Vị trí ứng tuyển', example: 'Nhân viên kinh doanh' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  position: string;

  @ApiPropertyOptional({
    description: 'Nguồn ứng viên',
    enum: CandidateSource,
    example: CandidateSource.JOB_BOARD,
  })
  @IsOptional()
  @IsEnum(CandidateSource)
  source?: string;

  @ApiPropertyOptional({
    description: 'URL hồ sơ / CV',
    example: 'https://storage.tbs.vn/resumes/cv-abc.pdf',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resumeUrl?: string;

  @ApiPropertyOptional({ description: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
