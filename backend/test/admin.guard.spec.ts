import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AdminGuard } from '../src/auth/guards/admin.guard';
import type { AuthenticatedRequest } from '../src/auth/types/authenticated-request';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows admin users', () => {
    const request: AuthenticatedRequest = {
      headers: {},
      user: {
        email: 'admin@bookshelf.local',
        id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
        role: UserRole.ADMIN,
        username: 'admin',
      },
    };

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
  });

  it('rejects non-admin users', () => {
    const request: AuthenticatedRequest = {
      headers: {},
      user: {
        email: 'reader@example.com',
        id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
        role: UserRole.USER,
        username: null,
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(ForbiddenException);
  });
});

function createExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
