import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { email, form, minLength, required, submit } from '@angular/forms/signals';

import { Auth } from '../../../core/auth/auth';
import type { SignupRequest } from '../../../core/api/api.types';
import { UiFormControl } from '../../../shared/ui/form-control/form-control';

/**
 * Account creation route for new authenticated readers.
 */
@Component({
  selector: 'app-sign-up',
  imports: [RouterLink, UiFormControl],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUp {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly model = signal({ displayName: '', email: '', password: '' });

  protected readonly error = signal<string | null>(null);
  protected readonly signUpForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Use a valid email address.' });
    required(path.password, { message: 'Password is required.' });
    minLength(path.password, 8, { message: 'Use at least 8 characters.' });
  });
  /**
   * Creates an account, omitting blank optional display name, then enters the app shell.
   */
  protected async submitSignUp(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);

    const successful = await submit(this.signUpForm, async (formTree) => {
      const value = formTree().value();
      const request: SignupRequest = {
        email: value.email,
        password: value.password,
        ...(value.displayName.trim() ? { displayName: value.displayName.trim() } : {}),
      };

      await this.auth.signUp(request);
    });

    if (successful) {
      await this.router.navigate(['/app/library']);
      return;
    }

    this.error.set('That account could not be created.');
  }
}
