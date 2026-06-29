import type { AuthenticatedUser } from './authenticated-user';

export type HttpHeaderValue = string | string[] | undefined;

export type AuthenticatedRequest = {
  headers: Record<string, HttpHeaderValue>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
  user?: AuthenticatedUser;
};
