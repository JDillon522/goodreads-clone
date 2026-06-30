import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { ReadingGoalResponse, UpdateReadingGoalRequest } from '../api/api.types';
import { SessionStore } from '../session/session-store';

@Injectable({ providedIn: 'root' })
export class Goals {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  public current(): Promise<ReadingGoalResponse> {
    return this.api.get<ReadingGoalResponse>('/api/goals/current');
  }

  public get(year: number): Promise<ReadingGoalResponse> {
    return this.api.get<ReadingGoalResponse>(`/api/goals/${year}`);
  }

  public async update(year: number, request: UpdateReadingGoalRequest): Promise<ReadingGoalResponse> {
    const response = await this.api.put<ReadingGoalResponse, UpdateReadingGoalRequest>(`/api/goals/${year}`, request);
    this.session.markGuestChanged();
    return response;
  }
}
