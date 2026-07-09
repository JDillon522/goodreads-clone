import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionStore } from '../session/session-store';

/**
 * Adds the active user or guest bearer token to API requests.
 *
 * Requests are left untouched when no session exists so public auth and landing
 * flows do not receive a bogus Authorization header.
 */
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(SessionStore).bearerToken();

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
