import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Allows only authenticated users with the ADMIN role through controller endpoints.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Checks the user attached by AccessTokenGuard and fails with Forbidden for non-admin accounts.
   */
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access is required.');
    }

    return true;
  }
}
