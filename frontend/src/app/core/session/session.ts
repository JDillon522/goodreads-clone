import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { SessionStatusResponse } from '../api/api.types';

/**
 * API wrapper for backend session validation.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(ApiClient);
  /**
   * Checks whether the current bearer token maps to an active guest or user session.
   */
  public status(): Promise<SessionStatusResponse> {
    return this.api.get<SessionStatusResponse>('/api/session/status');
  }
}
