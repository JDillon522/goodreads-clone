/**
 * Defines the normalized owner model shared by user and guest APIs. Services use this context to
 * build the correct Prisma ownership predicates without branching at every call site.
 */
export type UserOwnerContext = {
  guestSessionId?: never;
  type: 'user';
  userId: string;
};

export type GuestOwnerContext = {
  guestSessionId: string;
  type: 'guest';
  userId?: never;
};

export type OwnerContext = GuestOwnerContext | UserOwnerContext;

export type OwnerRecord = {
  guestSessionId?: string;
  userId?: string;
};
/**
 * Creates an owner context for guest-session scoped data.
 */
export function guestOwnerContext(guestSessionId: string): GuestOwnerContext {
  return {
    guestSessionId,
    type: 'guest',
  };
}
/**
 * Converts an owner context into the `{ userId }` or `{ guestSessionId }` fields used by Prisma.
 */
export function ownerRecord(owner: OwnerContext): OwnerRecord {
  return owner.type === 'user'
    ? { userId: owner.userId }
    : { guestSessionId: owner.guestSessionId };
}
/**
 * Creates an owner context for authenticated-user scoped data.
 */
export function userOwnerContext(userId: string): OwnerContext {
  return {
    type: 'user',
    userId,
  };
}
