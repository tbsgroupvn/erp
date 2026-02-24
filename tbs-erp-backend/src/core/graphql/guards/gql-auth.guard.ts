import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * JWT auth guard that works with both REST and GraphQL contexts.
 * Extracts the JWT from the GraphQL context's request object.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Override getRequest to extract the HTTP request from the GraphQL context.
   * This allows Passport to find the Authorization header in GQL requests.
   */
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext();
    // The request is attached to the GraphQL context by our context factory
    return gqlCtx.req;
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: Error | undefined,
  ): TUser {
    if (err) {
      throw new UnauthorizedException(err.message);
    }

    if (info instanceof TokenExpiredError) {
      throw new UnauthorizedException(
        'Access token has expired. Please refresh your token.',
      );
    }

    if (info instanceof JsonWebTokenError) {
      throw new UnauthorizedException(
        'Invalid access token. Please log in again.',
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'Authentication token is missing or invalid. Please log in.',
      );
    }

    return user;
  }
}
