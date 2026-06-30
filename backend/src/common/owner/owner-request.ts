import type { HttpHeaderValue } from '../../auth/types/authenticated-request';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import type { OwnerContext } from './owner-context';

export type OwnerRequest = {
  headers: Record<string, HttpHeaderValue>;
  owner?: OwnerContext;
  user?: AuthenticatedUser;
};
