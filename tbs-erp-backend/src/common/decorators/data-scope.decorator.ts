import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataScopeFilter } from '../guards/data-scope.guard';

/**
 * Parameter decorator that extracts the data scope filter from the request.
 * The data scope is injected by the DataScopeGuard after building role-based filters.
 */
export const DataScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DataScopeFilter | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.dataScope as DataScopeFilter | undefined;
  },
);
