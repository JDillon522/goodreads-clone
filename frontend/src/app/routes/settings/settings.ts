import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Auth } from '../../core/auth/auth';
import { SessionStore } from '../../core/session/session-store';
import { Theme, ThemePreference } from '../../core/theme/theme';

@Component({
  selector: 'app-settings',
  imports: [DatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(Theme);

  protected setTheme(preference: ThemePreference): void {
    this.theme.setPreference(preference);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
}
