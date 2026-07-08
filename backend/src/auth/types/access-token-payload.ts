import type { UserRole } from '@prisma/client';

export type AccessTokenPayload = {
  email: string;
  exp?: number;
  iat?: number;
  role?: UserRole;
  sub: string;
  type: 'access';
  username?: null | string;
};
