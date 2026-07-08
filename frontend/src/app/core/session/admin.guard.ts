import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from './session-store';

export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionStore);

  if (session.isAdmin()) {
    return true;
  }

  return inject(Router).createUrlTree(['/app/library']);
};
