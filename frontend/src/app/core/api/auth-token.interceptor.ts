import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionStore } from '../session/session-store';

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
