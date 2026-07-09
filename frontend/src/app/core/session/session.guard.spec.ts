import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { Session } from './session';
import { sessionGuard } from './session.guard';

class MockSession {
  public readonly status = vi.fn().mockResolvedValue({
    authenticated: true,
    ownerType: 'USER',
  });
}

describe('sessionGuard', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('validates stored user sessions through the backend status endpoint', async () => {
    localStorage.setItem('bookshelf.accessToken', 'token');
    const session = new MockSession();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Session, useValue: session }],
    });

    const result = await TestBed.runInInjectionContext(() =>
      sessionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
    expect(session.status).toHaveBeenCalled();
  });

  it('clears stale sessions and redirects to sign in when backend validation fails', async () => {
    localStorage.setItem('bookshelf.accessToken', 'stale-token');
    localStorage.setItem('bookshelf.refreshToken', 'refresh-token');
    localStorage.setItem('bookshelf.userEmail', 'reader@example.com');
    const session = new MockSession();
    session.status.mockRejectedValueOnce(new Error('Unauthorized'));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Session, useValue: session }],
    });
    const router = TestBed.inject(Router);

    const result = (await TestBed.runInInjectionContext(() =>
      sessionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    )) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/auth/sign-in');
    expect(localStorage.getItem('bookshelf.accessToken')).toBeNull();
    expect(localStorage.getItem('bookshelf.refreshToken')).toBeNull();
    expect(localStorage.getItem('bookshelf.userEmail')).toBeNull();
  });

  it('redirects anonymous sessions to sign in without calling the backend', async () => {
    const session = new MockSession();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Session, useValue: session }],
    });
    const router = TestBed.inject(Router);

    const result = (await TestBed.runInInjectionContext(() =>
      sessionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    )) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/auth/sign-in');
    expect(session.status).not.toHaveBeenCalled();
  });
});
