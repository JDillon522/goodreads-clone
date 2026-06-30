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

export function guestOwnerContext(guestSessionId: string): GuestOwnerContext {
  return {
    guestSessionId,
    type: 'guest',
  };
}

export function ownerRecord(owner: OwnerContext): OwnerRecord {
  return owner.type === 'user'
    ? { userId: owner.userId }
    : { guestSessionId: owner.guestSessionId };
}

export function userOwnerContext(userId: string): OwnerContext {
  return {
    type: 'user',
    userId,
  };
}
