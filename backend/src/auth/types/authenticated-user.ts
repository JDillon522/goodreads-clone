import type { UserRole } from '@prisma/client';

/**
 * User context attached to requests after AccessTokenGuard validates the token and database user.
 */
export type AuthenticatedUser = {
  email: string;
  id: string;
  role: UserRole;
  username: null | string;
};
