import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route as public, bypassing JWT authentication.
 * Used for endpoints that should be accessible without authentication.
 *
 * @example
 * @Public()
 * @Post('leads')
 * captureLeads() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
