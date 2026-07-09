/**
 * Request metadata stored alongside refresh tokens for audit and future session management.
 */
export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
