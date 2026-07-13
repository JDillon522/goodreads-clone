import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from './session-store';

/** Keeps provider-backed image analysis unavailable to disposable guest sessions. */
export const signedInUserGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.isSignedIn() ? true : inject(Router).createUrlTree(['/app/library']);
};
