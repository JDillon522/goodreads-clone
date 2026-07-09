import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { GuestSessionResponse } from '../api/api.types';
import { SessionStore } from '../session/session-store';

/**
 * Guest-session API wrapper.
 *
 * Starting guest mode creates a backend guest owner and stores its tab-scoped
 * token in SessionStore.
 */
@Injectable({ providedIn: 'root' })
export class Guest {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  /**
   * Creates a guest session and activates it locally.
   */
  public async startSession(): Promise<GuestSessionResponse> {
    const response = await this.api.post<GuestSessionResponse>('/api/guest/session');
    this.session.setGuestSession(response);
    return response;
  }
}
