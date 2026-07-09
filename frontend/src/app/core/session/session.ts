import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { SessionStatusResponse } from '../api/api.types';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(ApiClient);

  public status(): Promise<SessionStatusResponse> {
    return this.api.get<SessionStatusResponse>('/api/session/status');
  }
}
