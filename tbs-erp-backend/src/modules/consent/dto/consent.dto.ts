import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ConsentType {
  DATA_PROCESSING = 'data_processing',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  THIRD_PARTY_SHARING = 'third_party_sharing',
}

export class GrantConsentDto {
  @ApiProperty({
    description: 'Type of consent',
    enum: ConsentType,
    example: ConsentType.DATA_PROCESSING,
  })
  @IsEnum(ConsentType)
  @IsNotEmpty()
  consentType: ConsentType;

  @ApiProperty({
    description: 'Whether consent is granted',
    example: true,
  })
  @IsBoolean()
  granted: boolean;

  @ApiProperty({
    description: 'Version of the policy being consented to',
    example: '1.0',
  })
  @IsString()
  @IsNotEmpty()
  version: string;
}

export class RevokeConsentDto {
  @ApiProperty({
    description: 'Type of consent to revoke',
    enum: ConsentType,
    example: ConsentType.MARKETING,
  })
  @IsEnum(ConsentType)
  @IsNotEmpty()
  consentType: ConsentType;
}

export class ConsentResponseDto {
  @ApiProperty({ description: 'Consent record ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Consent type', enum: ConsentType })
  consentType: string;

  @ApiProperty({ description: 'Whether consent is currently granted' })
  granted: boolean;

  @ApiPropertyOptional({ description: 'When consent was granted' })
  grantedAt: Date | null;

  @ApiPropertyOptional({ description: 'When consent was revoked' })
  revokedAt: Date | null;

  @ApiProperty({ description: 'Policy version consented to' })
  version: string;

  @ApiProperty({ description: 'When the record was created' })
  createdAt: Date;
}

export class ConsentAuditEntryDto {
  @ApiProperty({ description: 'Consent record ID' })
  id: string;

  @ApiProperty({ description: 'Consent type' })
  consentType: string;

  @ApiProperty({ description: 'Whether consent was granted' })
  granted: boolean;

  @ApiPropertyOptional({ description: 'When granted' })
  grantedAt: Date | null;

  @ApiPropertyOptional({ description: 'When revoked' })
  revokedAt: Date | null;

  @ApiPropertyOptional({ description: 'IP address at time of action' })
  ipAddress: string | null;

  @ApiPropertyOptional({ description: 'User agent at time of action' })
  userAgent: string | null;

  @ApiProperty({ description: 'Policy version' })
  version: string;

  @ApiProperty({ description: 'Record timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated' })
  updatedAt: Date;
}
