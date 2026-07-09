import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Guest } from '../../core/guest/guest';
import { Theme } from '../../core/theme/theme';

/**
 * Public landing route with sign-in links, theme toggle access, and guest-mode entry.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly guest = inject(Guest);
  private readonly router = inject(Router);

  protected readonly theme = inject(Theme);
  protected readonly isStartingGuest = signal(false);
  protected readonly error = signal<string | null>(null);
  /**
   * Creates a guest owner, activates its token locally, and enters the app shell.
   */
  protected async startGuest(): Promise<void> {
    this.error.set(null);
    this.isStartingGuest.set(true);

    try {
      await this.guest.startSession();
      await this.router.navigate(['/app/library']);
    } catch {
      this.error.set('Guest mode is unavailable right now.');
    } finally {
      this.isStartingGuest.set(false);
    }
  }
}
