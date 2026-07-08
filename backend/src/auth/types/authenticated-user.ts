import type { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  email: string;
  id: string;
  role: UserRole;
  username: null | string;
};
