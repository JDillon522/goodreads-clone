import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { ThemePreferenceResponse, UpdateThemePreferenceRequest } from '../api/api.types';
import { SessionStore } from '../session/session-store';

/**
 * API wrapper for owner-scoped user preferences.
 *
 * Theme preference writes also mark guest sessions dirty because guest-owned palette choices live in
 * the same temporary database session as guest shelves/library data.
 */
@Injectable({ providedIn: 'root' })
export class Preferences {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  /**
   * Loads the current owner theme preference and generated palette metadata.
   */
  public getTheme(): Promise<ThemePreferenceResponse> {
    return this.api.get<ThemePreferenceResponse>('/api/preferences/theme');
  }
  /**
   * Saves base theme or palette-source updates for the current owner.
   */
  public async updateTheme(
    request: UpdateThemePreferenceRequest,
  ): Promise<ThemePreferenceResponse> {
    const response = await this.api.put<ThemePreferenceResponse, UpdateThemePreferenceRequest>(
      '/api/preferences/theme',
      request,
    );
    this.session.markGuestChanged();
    return response;
  }
}
