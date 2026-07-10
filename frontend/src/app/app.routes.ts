import { Routes } from '@angular/router';

import { adminGuard } from './core/session/admin.guard';
import { sessionGuard } from './core/session/session.guard';

/**
 * Lazy route map for the public auth screens and protected app shell.
 *
 * The `/app` branch validates session status once, while `/app/admin` adds the
 * client-side admin role guard before loading the admin page.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./routes/landing/landing').then((m) => m.Landing),
    title: 'Bookshelf',
  },
  {
    path: 'auth/sign-in',
    loadComponent: () => import('./routes/auth/sign-in/sign-in').then((m) => m.SignIn),
    title: 'Sign in - Bookshelf',
  },
  {
    path: 'auth/sign-up',
    loadComponent: () => import('./routes/auth/sign-up/sign-up').then((m) => m.SignUp),
    title: 'Create account - Bookshelf',
  },
  {
    path: 'auth/password-reset',
    loadComponent: () =>
      import('./routes/auth/password-reset/password-reset').then((m) => m.PasswordReset),
    title: 'Reset password - Bookshelf',
  },
  {
    path: 'auth/password-reset/confirm',
    loadComponent: () =>
      import('./routes/auth/password-reset-confirm/password-reset-confirm').then(
        (m) => m.PasswordResetConfirm,
      ),
    title: 'Confirm reset - Bookshelf',
  },
  {
    path: 'app',
    canActivate: [sessionGuard],
    loadComponent: () => import('./routes/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'library' },
      {
        path: 'library',
        loadComponent: () => import('./routes/library/library').then((m) => m.Library),
        title: 'Library - Bookshelf',
      },
      {
        path: 'shelves/manage',
        loadComponent: () =>
          import('./routes/manage-shelves/manage-shelves').then((m) => m.ManageShelves),
        title: 'Manage shelves - Bookshelf',
      },
      {
        path: 'shelves/:id',
        loadComponent: () => import('./routes/shelf/shelf').then((m) => m.Shelf),
        title: 'Shelf - Bookshelf',
      },
      {
        path: 'search',
        loadComponent: () => import('./routes/search/search').then((m) => m.Search),
        title: 'Search - Bookshelf',
      },
      {
        path: 'book/:id',
        loadComponent: () => import('./routes/book-detail/book-detail').then((m) => m.BookDetail),
        title: 'Book - Bookshelf',
      },
      {
        path: 'books/:id',
        loadComponent: () => import('./routes/book-detail/book-detail').then((m) => m.BookDetail),
        title: 'Book - Bookshelf',
      },
      {
        path: 'book-info/google/:id',
        loadComponent: () => import('./routes/book-info/book-info').then((m) => m.BookInfo),
        title: 'Book info - Bookshelf',
      },
      {
        path: 'goals',
        loadComponent: () => import('./routes/goals/goals').then((m) => m.Goals),
        title: 'Goals - Bookshelf',
      },
      {
        path: 'stats',
        loadComponent: () => import('./routes/stats/stats').then((m) => m.Stats),
        title: 'Stats - Bookshelf',
      },
      {
        path: 'settings',
        loadComponent: () => import('./routes/settings/settings').then((m) => m.Settings),
        title: 'Settings - Bookshelf',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./routes/admin/admin').then((m) => m.Admin),
        title: 'Admin - Bookshelf',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./routes/not-found/not-found').then((m) => m.NotFound),
    title: 'Not found - Bookshelf',
  },
];
