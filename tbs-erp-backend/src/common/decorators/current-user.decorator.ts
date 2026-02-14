import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ICurrentUser } from '../interfaces/current-user.interface';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 * The user object is injected by the JWT authentication guard after token validation.
 *
 * @example
 * // Get the full user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: ICurrentUser) {
 *   return user;
 * }
 *
 * @example
 * // Get a specific property of the user
 * @Get('my-orders')
 * getMyOrders(@CurrentUser('id') userId: string) {
 *   return this.orderService.findByUserId(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof ICurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
