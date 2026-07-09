import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from './session-store';

/**
 * Route guard for admin-only screens.
 *
 * Admin role is already hydrated by the session guard before child routes load,
 * so this guard only checks the client-side role and redirects normal users.
 */
export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionStore);

  if (session.isAdmin()) {
    return true;
  }

  return inject(Router).createUrlTree(['/app/library']);
};
