import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Auth } from '../../core/auth/auth';
import type { ThemePaletteTokenSet } from '../../core/api/api.types';
import { SessionStore } from '../../core/session/session-store';
import { Theme, ThemePaletteMode, ThemePreference } from '../../core/theme/theme';

/**
 * Settings route for session metadata, theme preference, and sign-out.
 */
type ThemeSwatch = {
  label: string;
  token: keyof ThemePaletteTokenSet;
  tone: 'dark' | 'light';
};

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
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly themeSwatches: readonly ThemeSwatch[] = [
    { label: 'Light background', token: '--color-bg-primary', tone: 'light' },
    { label: 'Light surface', token: '--color-surface', tone: 'light' },
    { label: 'Light accent', token: '--color-accent', tone: 'light' },
    { label: 'Light highlight', token: '--color-highlight', tone: 'light' },
    { label: 'Dark background', token: '--color-bg-primary', tone: 'dark' },
    { label: 'Dark surface', token: '--color-surface', tone: 'dark' },
    { label: 'Dark accent', token: '--color-accent', tone: 'dark' },
    { label: 'Dark highlight', token: '--color-highlight', tone: 'dark' },
  ];
  /**
   * Applies the selected theme preference through the shared theme service.
   */
  protected async setTheme(preference: ThemePreference): Promise<void> {
    await this.saveTheme(() => this.theme.setPreference(preference), 'Theme updated.');
  }
  /**
   * Applies a color source mode through the persisted theme preference service.
   */
  protected async setPaletteMode(mode: ThemePaletteMode): Promise<void> {
    await this.saveTheme(() => this.theme.setPaletteMode(mode), 'Color source updated.');
  }
  /**
   * Signs out and returns to the public landing route.
   */
  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
  /**
   * Wraps theme writes with route-local status messaging.
   */
  private async saveTheme(action: () => Promise<void>, message: string): Promise<void> {
    this.error.set(null);
    this.status.set(null);

    try {
      await action();
      this.status.set(message);
    } catch {
      this.error.set('Theme preferences could not be saved.');
    }
  }
}
