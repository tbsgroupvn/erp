import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * Validates and transforms a string value into an OrderStatus enum value.
 * Throws BadRequestException if the string is not a valid OrderStatus.
 *
 * @example
 * // As a parameter pipe
 * @Get(':status')
 * findByStatus(@Param('status', ParseOrderStatusPipe) status: OrderStatus) { ... }
 *
 * @example
 * // As a query pipe
 * @Get()
 * findAll(@Query('status', ParseOrderStatusPipe) status: OrderStatus) { ... }
 */
@Injectable()
export class ParseOrderStatusPipe implements PipeTransform<string, OrderStatus> {
  private readonly validStatuses = Object.values(OrderStatus);

  transform(value: string, metadata: ArgumentMetadata): OrderStatus {
    if (!value) {
      throw new BadRequestException(
        `${metadata.data || 'status'} is required.`,
      );
    }

    const uppercased = value.toUpperCase().trim();

    if (!this.validStatuses.includes(uppercased as OrderStatus)) {
      throw new BadRequestException(
        `"${value}" is not a valid order status. Valid values are: ${this.validStatuses.join(', ')}.`,
      );
    }

    return uppercased as OrderStatus;
  }
}
