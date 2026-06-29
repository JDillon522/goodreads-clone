import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authenticated user context is missing.');
    }

    return request.user;
  },
);
