import type { AuthenticatedUser } from './authenticated-user';

/**
 * Describes the minimal request shape auth guards and decorators need from Nest/Express.
 */
export type HttpHeaderValue = string | string[] | undefined;

export type AuthenticatedRequest = {
  headers: Record<string, HttpHeaderValue>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  user?: AuthenticatedUser;
};
