export type AccessTokenPayload = {
  email: string;
  exp?: number;
  iat?: number;
  sub: string;
  type: 'access';
};
