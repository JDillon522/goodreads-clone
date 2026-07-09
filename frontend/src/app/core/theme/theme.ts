import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

/**
 * Theme preference service.
 *
 * Stores explicit light/dark choices in localStorage, lets `system` follow the
 * OS preference, and writes `data-theme` only when the user overrides system.
 */
export type ThemePreference = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';

const themePreferenceKey = 'bookshelf.theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly preferenceValue = signal<ThemePreference>(this.readPreference());

  public readonly preference = this.preferenceValue.asReadonly();
  public readonly effectiveTheme = computed<EffectiveTheme>(() => {
    const preference = this.preferenceValue();

    if (preference !== 'system') {
      return preference;
    }

    return this.prefersDark() ? 'dark' : 'light';
  });
  /**
   * Applies the current preference whenever the stored preference signal changes.
   */
  public constructor() {
    effect(() => {
      this.applyPreference(this.preferenceValue());
    });
  }
  /**
   * Saves an explicit preference or clears storage when returning to system mode.
   */
  public setPreference(preference: ThemePreference): void {
    this.preferenceValue.set(preference);

    if (preference === 'system') {
      localStorage.removeItem(themePreferenceKey);
      return;
    }

    localStorage.setItem(themePreferenceKey, preference);
  }
  /**
   * Toggles between explicit light and dark based on the currently effective theme.
   */
  public toggle(): void {
    this.setPreference(this.effectiveTheme() === 'dark' ? 'light' : 'dark');
  }
  /**
   * Updates the document root attribute consumed by CSS theme selectors.
   */
  private applyPreference(preference: ThemePreference): void {
    const root = this.document.documentElement;

    if (preference === 'system') {
      root.removeAttribute('data-theme');
      return;
    }

    root.setAttribute('data-theme', preference);
  }
  /**
   * Reads a valid stored preference, falling back to system for unknown values.
   */
  private readPreference(): ThemePreference {
    const stored = localStorage.getItem(themePreferenceKey);

    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }

    return 'system';
  }
  /**
   * Checks the OS color scheme only while the app is in system mode.
   */
  private prefersDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
