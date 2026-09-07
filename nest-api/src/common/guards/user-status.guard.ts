import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Equivalent to Laravel's `check.user.status` middleware.
 * Blocks access if the authenticated user has status = false (blocked by admin).
 */
@Injectable()
export class UserStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    // user is set by JwtAuthGuard — it contains the DB user fetched by JwtStrategy
    if (user && user.status === false) {
      throw new ForbiddenException({
        res: 'error',
        message: 'Your account has been blocked by the administrator.',
        error: 'account_blocked',
      });
    }
    return true;
  }
}
