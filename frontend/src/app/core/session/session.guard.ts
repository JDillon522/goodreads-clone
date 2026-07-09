import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Session } from './session';
import { SessionStore } from './session-store';

export const sessionGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.hasSession()) {
    try {
      await inject(Session).status();
      return true;
    } catch {
      session.clear();
      return router.createUrlTree(['/auth/sign-in']);
    }
  }

  return router.createUrlTree(['/auth/sign-in']);
};
