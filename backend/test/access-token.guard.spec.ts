import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

import { AccessTokenGuard } from '../src/auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../src/auth/types/authenticated-request';
import { PrismaService } from '../src/database/prisma.service';

describe('AccessTokenGuard', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('dev-only-access-secret-replace-before-deploy'),
  } as unknown as ConfigService;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const userFindUnique = jest.fn();
  const prismaService = {
    user: {
      findUnique: userFindUnique,
    },
  } as unknown as PrismaService;

  let guard: AccessTokenGuard;
  let request: AuthenticatedRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AccessTokenGuard(configService, jwtService, prismaService);
    request = { headers: {} };
  });

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid or expired bearer tokens', async () => {
    request.headers.authorization = 'Bearer expired-token';
    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValueOnce(new Error('expired'));

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the authenticated user for a valid access token', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValueOnce({
      email: 'reader@example.com',
      sub: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      type: 'access',
    });
    userFindUnique.mockResolvedValueOnce({
      deactivatedAt: null,
      email: 'reader@example.com',
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      role: UserRole.USER,
      username: null,
    });

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      email: 'reader@example.com',
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      role: UserRole.USER,
      username: null,
    });
  });
});

function createExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
