export type OwnerContext = {
  guestSessionId?: never;
  type: 'user';
  userId: string;
};

export function userOwnerContext(userId: string): OwnerContext {
  return {
    type: 'user',
    userId,
  };
}
