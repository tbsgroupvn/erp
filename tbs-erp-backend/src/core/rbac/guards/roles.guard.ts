import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getRoleLabel } from '../roles.enum';
import { ICurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the required roles from both handler and class level,
    // handler-level takes precedence
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // BAC-07 fix: If no @Roles() decorator, allow all authenticated users.
    // This is intentional — endpoints that need restriction MUST use @Roles().
    // The security audit recommends adding @Roles() to every endpoint rather
    // than defaulting to deny here, which would break many existing endpoints.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;

    if (!user) {
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        'Khong tim thay thong tin nguoi dung.',
        HttpStatus.FORBIDDEN,
      );
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      const userRoleLabel = getRoleLabel(user.role);
      const requiredLabels = requiredRoles.map(r => getRoleLabel(r)).join(', ');
      throw new DomainException(
        ErrorCode.FORBIDDEN,
        `Ban khong co quyen thuc hien thao tac nay. Vai tro hien tai: ${userRoleLabel}. Yeu cau: ${requiredLabels}`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
