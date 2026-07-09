import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

import type {
  ThemePalette,
  ThemePaletteSource,
  ThemePaletteTokenSet,
  ThemePreferenceResponse,
  UpdateThemePreferenceRequest,
} from '../api/api.types';
import { Preferences } from '../preferences/preferences';
import { SessionStore } from '../session/session-store';

/**
 * Theme preference service.
 *
 * Stores explicit light/dark choices locally for instant startup, hydrates persisted owner
 * preferences from the backend, and layers book-cover palette CSS variables over the active base
 * light/dark theme.
 */
export type ThemePreference = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';
export type ThemePaletteMode = 'autoTopBook' | 'customBook' | 'default';

const themePreferenceKey = 'bookshelf.theme';
const themePaletteCacheKey = 'bookshelf.theme.palette';
const themePaletteModeKey = 'bookshelf.theme.paletteMode';
const themePaletteSourceKey = 'bookshelf.theme.paletteSource';
const themeCssVariables: readonly (keyof ThemePaletteTokenSet)[] = [
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-tertiary',
  '--color-surface',
  '--color-surface-raised',
  '--color-border',
  '--color-border-subtle',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-subtle',
  '--color-accent-muted',
  '--color-on-accent',
  '--color-focus-ring',
  '--color-highlight',
  '--color-highlight-subtle',
  '--color-on-highlight',
  '--color-progress',
  '--color-rating',
];

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(Preferences);
  private readonly session = inject(SessionStore);
  private readonly preferenceValue = signal<ThemePreference>(this.readPreference());
  private readonly paletteModeValue = signal<ThemePaletteMode>(this.readPaletteMode());
  private readonly paletteValue = signal<ThemePalette | null>(this.readPalette());
  private readonly paletteSourceValue = signal<ThemePaletteSource | null>(this.readPaletteSource());

  public readonly preference = this.preferenceValue.asReadonly();
  public readonly palette = this.paletteValue.asReadonly();
  public readonly paletteMode = this.paletteModeValue.asReadonly();
  public readonly paletteSource = this.paletteSourceValue.asReadonly();
  public readonly effectiveTheme = computed<EffectiveTheme>(() => {
    const preference = this.preferenceValue();

    if (preference !== 'system') {
      return preference;
    }

    return this.prefersDark() ? 'dark' : 'light';
  });
  /**
   * Applies base theme and book palette variables whenever the relevant signals change.
   */
  public constructor() {
    effect(() => {
      this.applyPreference(this.preferenceValue(), this.paletteValue(), this.effectiveTheme());
    });
  }
  /**
   * Loads persisted owner theme settings once a user or guest session has been validated.
   */
  public async hydrate(): Promise<void> {
    if (!this.session.hasSession()) {
      return;
    }

    try {
      this.applyServerPreference(await this.preferences.getTheme());
    } catch {
      // Theme hydration must never block app shell loading. The cached local
      // preference remains active and the next guarded navigation can retry.
    }
  }
  /**
   * Saves an explicit preference or clears storage when returning to system mode.
   */
  public async setPreference(preference: ThemePreference): Promise<void> {
    this.setLocalPreference(preference);

    if (!this.session.hasSession()) {
      return;
    }

    await this.persistTheme({ theme: preference });
  }
  /**
   * Selects default, automatic top-book, or custom-book palette mode.
   */
  public async setPaletteMode(mode: ThemePaletteMode): Promise<void> {
    const response = await this.persistTheme({ paletteMode: mode });
    this.applyServerPreference(response);
  }
  /**
   * Uses one owned library item's cover as the custom source palette.
   */
  public async useBookAsCustomTheme(libraryItemId: string): Promise<void> {
    const response = await this.persistTheme({
      libraryItemId,
      paletteMode: 'customBook',
    });
    this.applyServerPreference(response);
  }

  /**
   * Toggles between explicit light and dark based on the currently effective theme.
   */
  public async toggle(): Promise<void> {
    await this.setPreference(this.effectiveTheme() === 'dark' ? 'light' : 'dark');
  }
  /**
   * Applies backend preferences to local signals and the startup cache.
   */
  private applyServerPreference(response: ThemePreferenceResponse): void {
    this.setLocalPreference(response.theme);
    this.paletteModeValue.set(response.paletteMode);
    this.paletteValue.set(response.palette);
    this.paletteSourceValue.set(response.source);
    this.writePaletteCache(response);
  }
  /**
   * Updates the document root attribute and scoped CSS variables consumed by global styles.
   */
  private applyPreference(
    preference: ThemePreference,
    palette: ThemePalette | null,
    effectiveTheme: EffectiveTheme,
  ): void {
    const root = this.document.documentElement;

    if (preference === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }

    this.clearPaletteVariables(root);

    const tokenSet = palette?.[effectiveTheme];
    if (!tokenSet) {
      return;
    }

    for (const variable of themeCssVariables) {
      root.style.setProperty(variable, tokenSet[variable]);
    }
  }
  /**
   * Removes all palette-managed variables so base CSS theme values become active again.
   */
  private clearPaletteVariables(root: HTMLElement): void {
    for (const variable of themeCssVariables) {
      root.style.removeProperty(variable);
    }
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
   * Reads cached palette JSON used before backend hydration finishes.
   */
  private readPalette(): ThemePalette | null {
    return readJson<ThemePalette>(themePaletteCacheKey, isThemePalette);
  }
  /**
   * Reads cached palette mode used to keep settings visually stable before hydration.
   */
  private readPaletteMode(): ThemePaletteMode {
    const stored = localStorage.getItem(themePaletteModeKey);

    if (stored === 'autoTopBook' || stored === 'customBook' || stored === 'default') {
      return stored;
    }

    return 'default';
  }
  /**
   * Reads cached source metadata used by the settings page before hydration finishes.
   */
  private readPaletteSource(): ThemePaletteSource | null {
    return readJson<ThemePaletteSource>(themePaletteSourceKey, isThemePaletteSource);
  }
  /**
   * Writes local base preference state without requiring a backend round trip.
   */
  private setLocalPreference(preference: ThemePreference): void {
    this.preferenceValue.set(preference);

    if (preference === 'system') {
      localStorage.removeItem(themePreferenceKey);
      return;
    }

    localStorage.setItem(themePreferenceKey, preference);
  }
  /**
   * Persists preference updates when a session exists and returns the saved server state.
   */
  private persistTheme(request: UpdateThemePreferenceRequest): Promise<ThemePreferenceResponse> {
    if (!this.session.hasSession()) {
      return Promise.resolve({
        palette: this.paletteValue(),
        paletteMode: this.paletteModeValue(),
        source: this.paletteSourceValue(),
        theme: this.preferenceValue(),
      });
    }

    return this.preferences.updateTheme(request);
  }
  /**
   * Checks the OS color scheme only while the app is in system mode.
   */
  private prefersDark(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
  /**
   * Caches the last successful server preference for instant next-page startup.
   */
  private writePaletteCache(response: ThemePreferenceResponse): void {
    localStorage.setItem(themePaletteModeKey, response.paletteMode);

    if (response.palette) {
      localStorage.setItem(themePaletteCacheKey, JSON.stringify(response.palette));
    } else {
      localStorage.removeItem(themePaletteCacheKey);
    }

    if (response.source) {
      localStorage.setItem(themePaletteSourceKey, JSON.stringify(response.source));
    } else {
      localStorage.removeItem(themePaletteSourceKey);
    }
  }
}

/**
 * Checks that cached JSON has the paired light/dark token shape before applying it.
 */
function isThemePalette(value: unknown): value is ThemePalette {
  if (!isRecord(value) || !isRecord(value['light']) || !isRecord(value['dark'])) {
    return false;
  }

  const light = value['light'];
  const dark = value['dark'];

  return (
    themeCssVariables.every((variable) => typeof light[variable] === 'string') &&
    themeCssVariables.every((variable) => typeof dark[variable] === 'string')
  );
}

/**
 * Checks cached source metadata before displaying it in settings.
 */
function isThemePaletteSource(value: unknown): value is ThemePaletteSource {
  return (
    isRecord(value) &&
    (typeof value['libraryItemId'] === 'string' || value['libraryItemId'] === null) &&
    typeof value['title'] === 'string' &&
    (typeof value['coverUrl'] === 'string' || value['coverUrl'] === null) &&
    typeof value['generatedAt'] === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson<T>(key: string, guard: (value: unknown) => value is T): T | null {
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
