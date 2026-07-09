import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Session } from './session';
import { SessionStore } from './session-store';

/**
 * App-area route guard that validates stored tokens before protected routes render.
 *
 * The local session store can only prove that a token exists; `/api/session/status`
 * proves the backend still accepts it. Failed validation clears local state and
 * sends the user back to sign-in.
 */
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
