import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateQuotationDto } from './create-quotation.dto';

/**
 * DTO for updating an existing quotation.
 * All fields from CreateQuotationDto are optional, except customerId
 * which cannot be changed after creation.
 */
export class UpdateQuotationDto extends PartialType(
  OmitType(CreateQuotationDto, ['customerId'] as const),
) {}
