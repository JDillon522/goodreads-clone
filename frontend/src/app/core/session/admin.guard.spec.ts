import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('allows admin sessions', () => {
    localStorage.setItem('bookshelf.accessToken', 'token');
    localStorage.setItem('bookshelf.userRole', 'ADMIN');
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('redirects non-admin sessions to the library', () => {
    localStorage.setItem('bookshelf.accessToken', 'token');
    localStorage.setItem('bookshelf.userRole', 'USER');
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    const router = TestBed.inject(Router);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/app/library');
  });
});
