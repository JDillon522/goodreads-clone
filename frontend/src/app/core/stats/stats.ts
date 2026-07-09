import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { StatsSummaryResponse, YearInReviewResponse } from '../api/api.types';

/**
 * Stats API wrapper for yearly reading analytics.
 */
@Injectable({ providedIn: 'root' })
export class Stats {
  private readonly api = inject(ApiClient);
  /**
   * Loads aggregate reading stats for a year, defaulting to the current year.
   */
  public summary(year = new Date().getFullYear()): Promise<StatsSummaryResponse> {
    return this.api.get<StatsSummaryResponse>(`/api/stats/summary?year=${year}`);
  }
  /**
   * Loads the current year-in-review payload used by the stats route.
   */
  public yearInReview(year = new Date().getFullYear()): Promise<YearInReviewResponse> {
    return this.api.get<YearInReviewResponse>(`/api/stats/year-in-review/${year}`);
  }
}
