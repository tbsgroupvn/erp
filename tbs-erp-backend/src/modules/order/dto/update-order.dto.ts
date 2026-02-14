import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * DTO for updating an existing order.
 * All fields from CreateOrderDto are optional, except customerId
 * which cannot be changed after creation.
 */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['customerId'] as const),
) {}
