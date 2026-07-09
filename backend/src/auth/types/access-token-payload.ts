import type { UserRole } from '@prisma/client';

/**
 * JWT payload signed into short-lived access tokens and verified by API guards.
 */
export type AccessTokenPayload = {
  email: string;
  exp?: number;
  iat?: number;
  role?: UserRole;
  sub: string;
  type: 'access';
  username?: null | string;
};
