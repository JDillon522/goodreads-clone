import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { ReadingGoalResponse, UpdateReadingGoalRequest } from '../api/api.types';
import { SessionStore } from '../session/session-store';

/**
 * Reading-goal API wrapper for the current owner.
 *
 * Goal writes mark guest sessions dirty because goal settings are part of the
 * guest-owned demo state.
 */
@Injectable({ providedIn: 'root' })
export class Goals {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  /**
   * Loads the current calendar year's goal.
   */
  public current(): Promise<ReadingGoalResponse> {
    return this.api.get<ReadingGoalResponse>('/api/goals/current');
  }
  /**
   * Loads a specific year's goal, creating backend defaults when needed.
   */
  public get(year: number): Promise<ReadingGoalResponse> {
    return this.api.get<ReadingGoalResponse>(`/api/goals/${year}`);
  }
  /**
   * Saves the yearly target and marks guest state dirty when applicable.
   */
  public async update(
    year: number,
    request: UpdateReadingGoalRequest,
  ): Promise<ReadingGoalResponse> {
    const response = await this.api.put<ReadingGoalResponse, UpdateReadingGoalRequest>(
      `/api/goals/${year}`,
      request,
    );
    this.session.markGuestChanged();
    return response;
  }
}
