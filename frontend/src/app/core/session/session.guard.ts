import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from './session-store';

export const sessionGuard: CanActivateFn = () => {
  const session = inject(SessionStore);

  if (session.hasSession()) {
    return true;
  }

  return inject(Router).createUrlTree(['/']);
};
