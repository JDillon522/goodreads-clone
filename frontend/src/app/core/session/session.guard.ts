import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Session } from './session';
import { SessionStore } from './session-store';
import { Theme } from '../theme/theme';

/**
 * App-area route guard that validates stored tokens before protected routes render.
 *
 * The local session store can only prove that a token exists; `/api/session/status`
 * proves the backend still accepts it. Failed validation clears local state and
 * sends the user back to sign-in.
 */
export const sessionGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const sessionApi = inject(Session);
  const theme = inject(Theme);
  const router = inject(Router);

  if (session.hasSession()) {
    try {
      await sessionApi.status();
    } catch {
      session.clear();
      return router.createUrlTree(['/auth/sign-in']);
    }

    try {
      await theme.hydrate();
    } catch {
      // Session validation controls route access; theme hydration is cosmetic and can retry later.
    }

    return true;
  }

  return router.createUrlTree(['/auth/sign-in']);
};
