import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { OwnerContext } from './owner-context';
import type { OwnerRequest } from './owner-request';

/**
 * Extracts the normalized owner context attached by OwnerTokenGuard.
 */
export const CurrentOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OwnerContext => {
    const request = context.switchToHttp().getRequest<OwnerRequest>();

    if (!request.owner) {
      throw new UnauthorizedException('Owner context is missing.');
    }

    return request.owner;
  },
);
