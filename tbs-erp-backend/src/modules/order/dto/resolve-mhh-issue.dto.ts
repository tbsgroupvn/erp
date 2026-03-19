import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MHHIssueResolution, Currency } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class ResolveMHHIssueDto {
  @ApiProperty({
    description: 'Resolution type for the issue',
    enum: MHHIssueResolution,
    example: MHHIssueResolution.REFUND,
  })
  @IsEnum(MHHIssueResolution, { message: 'Invalid resolution type' })
  resolution: MHHIssueResolution;

  @ApiPropertyOptional({
    description: 'Detailed note explaining the resolution',
    example: 'Full refund issued due to damaged goods. Supplier credited.',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  resolutionNote?: string;

  @ApiPropertyOptional({
    description: 'Compensation amount to be issued',
    example: 150000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Compensation amount must not be negative' })
  compensationAmount?: number;

  @ApiPropertyOptional({
    description: 'Currency of the compensation amount',
    enum: Currency,
    example: Currency.VND,
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'Invalid currency' })
  compensationCurrency?: Currency;
}
