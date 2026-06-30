import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { GuestSessionResponse } from '../api/api.types';
import { SessionStore } from '../session/session-store';

@Injectable({ providedIn: 'root' })
export class Guest {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  public async startSession(): Promise<GuestSessionResponse> {
    const response = await this.api.post<GuestSessionResponse>('/api/guest/session');
    this.session.setGuestSession(response);
    return response;
  }
}
