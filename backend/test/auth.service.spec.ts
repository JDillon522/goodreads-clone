import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import { AuthUserRecord, UsersService } from '../src/users/users.service';

describe('AuthService', () => {
  const authUser: AuthUserRecord = {
    createdAt: new Date('2026-06-29T12:00:00.000Z'),
    displayName: 'Ada Reader',
    email: 'reader@example.com',
    id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'development';
      }

      if (key === 'PASSWORD_RESET_TOKEN_TTL_MINUTES') {
        return 30;
      }

      return undefined;
    }),
    getOrThrow: jest.fn().mockReturnValue('dev-only-access-secret-replace-before-deploy'),
  } as unknown as ConfigService;
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  } as unknown as JwtService;
  const authRefreshTokenCreate = jest.fn().mockResolvedValue({ id: 'refresh-token-record-id' });
  const authRefreshTokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prismaService = {
    authRefreshToken: {
      create: authRefreshTokenCreate,
      updateMany: authRefreshTokenUpdateMany,
    },
  } as unknown as PrismaService;
  const createWithDefaults = jest.fn().mockResolvedValue(authUser);
  const findByEmail = jest.fn();
  const findById = jest.fn().mockResolvedValue(authUser);
  const usersService = {
    createWithDefaults,
    findByEmail,
    findById,
  } as unknown as UsersService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(configService, jwtService, prismaService, usersService);
  });

  it('normalizes signup input, creates default account data, and issues tokens', async () => {
    jest.spyOn(usersService, 'findByEmail').mockResolvedValueOnce(null);

    const response = await service.signup(
      {
        displayName: '  Ada Reader  ',
        email: '  READER@example.COM  ',
        password: 'correct-horse-battery-staple',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      },
    );

    expect(findByEmail).toHaveBeenCalledWith('reader@example.com');
    expect(createWithDefaults).toHaveBeenCalledWith({
      displayName: 'Ada Reader',
      email: 'reader@example.com',
      passwordHash: expect.any(String),
    });
    expect(authRefreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: '127.0.0.1',
        tokenHash: expect.any(String),
        userAgent: 'Jest',
        userId: authUser.id,
      }),
    });
    expect(response).toEqual({
      accessToken: 'access-token',
      expiresInSeconds: 900,
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      user: {
        createdAt: '2026-06-29T12:00:00.000Z',
        displayName: 'Ada Reader',
        email: 'reader@example.com',
        id: authUser.id,
      },
    });
  });

  it('rejects duplicate signup emails', async () => {
    jest.spyOn(usersService, 'findByEmail').mockResolvedValueOnce({
      ...authUser,
      passwordHash: 'hash',
    });

    await expect(
      service.signup(
        {
          email: 'reader@example.com',
          password: 'correct-horse-battery-staple',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createWithDefaults).not.toHaveBeenCalled();
  });
});
