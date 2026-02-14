import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip credit check validation for specific endpoints
 * Use this for admin overrides or special cases
 *
 * @example
 * @Post()
 * @SkipCreditCheck()
 * async createOrderWithOverride(@Body() dto: CreateOrderDto) {
 *   // This will bypass credit checks
 * }
 */
export const SkipCreditCheck = () => SetMetadata('skipCreditCheck', true);
