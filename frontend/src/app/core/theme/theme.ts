import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

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

  public constructor() {
    effect(() => {
      this.applyPreference(this.preferenceValue());
    });
  }

  public setPreference(preference: ThemePreference): void {
    this.preferenceValue.set(preference);

    if (preference === 'system') {
      localStorage.removeItem(themePreferenceKey);
      return;
    }

    localStorage.setItem(themePreferenceKey, preference);
  }

  public toggle(): void {
    this.setPreference(this.effectiveTheme() === 'dark' ? 'light' : 'dark');
  }

  private applyPreference(preference: ThemePreference): void {
    const root = this.document.documentElement;

    if (preference === 'system') {
      root.removeAttribute('data-theme');
      return;
    }

    root.setAttribute('data-theme', preference);
  }

  private readPreference(): ThemePreference {
    const stored = localStorage.getItem(themePreferenceKey);

    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }

    return 'system';
  }

  private prefersDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
