import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth } from '../../core/auth/auth';
import { PasswordReset } from './password-reset/password-reset';
import { PasswordResetConfirm } from './password-reset-confirm/password-reset-confirm';
import { SignIn } from './sign-in/sign-in';
import { SignUp } from './sign-up/sign-up';

const authPages: ReadonlyArray<readonly [string, Type<unknown>]> = [
  ['sign in', SignIn],
  ['sign up', SignUp],
  ['password reset', PasswordReset],
  ['password reset confirmation', PasswordResetConfirm],
];

describe.each(authPages)('%s page', (_name, component) => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [provideRouter([]), { provide: Auth, useValue: {} }],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('links explicitly back to the home page', async () => {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();

    const homeLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.auth-home-link a',
    );

    expect(homeLink?.textContent?.trim()).toBe('Back to home');
    expect(homeLink?.getAttribute('href')).toBe('/');
  });
});
