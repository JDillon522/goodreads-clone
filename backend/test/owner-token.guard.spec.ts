import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { OwnerTokenGuard } from '../src/common/owner/owner-token.guard';
import type { OwnerRequest } from '../src/common/owner/owner-request';
import { hashOpaqueToken } from '../src/common/security/opaque-token';
import { PrismaService } from '../src/database/prisma.service';

describe('OwnerTokenGuard', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('dev-only-access-secret-replace-before-deploy'),
  } as unknown as ConfigService;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const guestFindUnique = jest.fn();
  const guestUpdate = jest.fn();
  const prismaService = {
    guestSession: {
      findUnique: guestFindUnique,
      update: guestUpdate,
    },
  } as unknown as PrismaService;

  let guard: OwnerTokenGuard;
  let request: OwnerRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new OwnerTokenGuard(configService, jwtService, prismaService);
    request = { headers: {} };
  });

  it('attaches a user owner for a valid access token', async () => {
    request.headers.authorization = 'Bearer valid-user-token';
    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValueOnce({
      email: 'reader@example.com',
      sub: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      type: 'access',
    });

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.owner).toEqual({
      type: 'user',
      userId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    });
    expect(request.user).toEqual({
      email: 'reader@example.com',
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    });
    expect(guestFindUnique).not.toHaveBeenCalled();
  });

  it('attaches a guest owner for a valid guest token', async () => {
    const guestToken = 'guest-token';

    request.headers.authorization = `Bearer ${guestToken}`;
    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValueOnce(new Error('not a jwt'));
    guestFindUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 60_000),
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    });
    guestUpdate.mockResolvedValueOnce({});

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(guestFindUnique).toHaveBeenCalledWith({
      select: { expiresAt: true, id: true },
      where: { tokenHash: hashOpaqueToken(guestToken) },
    });
    expect(request.owner).toEqual({
      guestSessionId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      type: 'guest',
    });
  });

  it('rejects missing, invalid, and expired tokens', async () => {
    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    request.headers.authorization = 'Bearer expired-guest-token';
    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValueOnce(new Error('not a jwt'));
    guestFindUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 60_000),
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    });

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

function createExecutionContext(request: OwnerRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
