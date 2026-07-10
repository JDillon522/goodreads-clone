import { routes } from './app.routes';

/**
 * Protects user-facing book URLs while the app keeps the older plural route compatible.
 */
describe('routes', () => {
  it('supports singular and legacy plural saved-book detail paths', () => {
    const appRoute = routes.find((route) => route.path === 'app');
    const childPaths = appRoute?.children?.map((route) => route.path) ?? [];

    expect(childPaths).toContain('book/:id');
    expect(childPaths).toContain('books/:id');
  });
});
