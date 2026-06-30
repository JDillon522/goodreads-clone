import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { email, form, FormField, required, submit } from '@angular/forms/signals';

import { Auth } from '../../../core/auth/auth';

@Component({
  selector: 'app-password-reset',
  imports: [FormField, RouterLink],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordReset {
  private readonly auth = inject(Auth);
  private readonly model = signal({ email: '' });

  protected readonly message = signal<string | null>(null);
  protected readonly resetToken = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly resetForm = form(this.model, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Use a valid email address.' });
  });

  protected async submitReset(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.message.set(null);
    this.resetToken.set(null);

    const successful = await submit(this.resetForm, async (formTree) => {
      const response = await this.auth.requestPasswordReset(formTree().value());
      this.message.set(response.message);
      this.resetToken.set(response.resetToken ?? null);
    });

    if (!successful) {
      this.error.set('Password reset request failed.');
    }
  }
}
