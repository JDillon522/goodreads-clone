import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, submit } from '@angular/forms/signals';

import { Auth } from '../../../core/auth/auth';

@Component({
  selector: 'app-sign-in',
  imports: [FormField, RouterLink],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly model = signal({ email: '', password: '' });

  protected readonly error = signal<string | null>(null);
  protected readonly signInForm = form(this.model, (path) => {
    required(path.email, { message: 'Email or username is required.' });
    required(path.password, { message: 'Password is required.' });
  });

  protected async submitSignIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);

    const successful = await submit(this.signInForm, async (formTree) => {
      await this.auth.signIn(formTree().value());
    });

    if (successful) {
      await this.router.navigate(['/app/library']);
      return;
    }

    this.error.set('Check your email or username and password.');
  }
}
