import { createHash, randomBytes } from 'node:crypto';

/**
 * Shared helpers for bearer-style opaque tokens such as guest-session and reset-token secrets.
 */
export function createOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}
/**
 * Hashes opaque tokens before storage so database rows do not contain usable bearer credentials.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
