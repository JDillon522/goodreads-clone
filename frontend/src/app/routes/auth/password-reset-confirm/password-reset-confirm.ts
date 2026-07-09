import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, minLength, required, submit } from '@angular/forms/signals';

import { Auth } from '../../../core/auth/auth';
import { UiFormControl } from '../../../shared/ui/form-control/form-control';

/**
 * Password reset confirmation route.
 */
@Component({
  selector: 'app-password-reset-confirm',
  imports: [RouterLink, UiFormControl],
  templateUrl: './password-reset-confirm.html',
  styleUrl: './password-reset-confirm.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordResetConfirm {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly model = signal({ token: '', newPassword: '' });

  protected readonly error = signal<string | null>(null);
  protected readonly confirmForm = form(this.model, (path) => {
    required(path.token, { message: 'Reset token is required.' });
    required(path.newPassword, { message: 'New password is required.' });
    minLength(path.newPassword, 8, { message: 'Use at least 8 characters.' });
  });
  /**
   * Exchanges a reset token for a fresh auth session and enters the app shell.
   */
  protected async submitConfirm(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);

    const successful = await submit(this.confirmForm, async (formTree) => {
      await this.auth.confirmPasswordReset(formTree().value());
    });

    if (successful) {
      await this.router.navigate(['/app/library']);
      return;
    }

    this.error.set('The reset token could not be used.');
  }
}
