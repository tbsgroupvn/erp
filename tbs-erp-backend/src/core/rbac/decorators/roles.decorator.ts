import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator that sets the required roles for accessing a route handler.
 * Used in conjunction with the RolesGuard.
 *
 * @example
 * @Roles(UserRole.CEO, UserRole.COO)
 * @Get('admin/dashboard')
 * getDashboard() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
