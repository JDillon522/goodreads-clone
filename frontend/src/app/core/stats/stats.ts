import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { StatsSummaryResponse, YearInReviewResponse } from '../api/api.types';

@Injectable({ providedIn: 'root' })
export class Stats {
  private readonly api = inject(ApiClient);

  public summary(year = new Date().getFullYear()): Promise<StatsSummaryResponse> {
    return this.api.get<StatsSummaryResponse>(`/api/stats/summary?year=${year}`);
  }

  public yearInReview(year = new Date().getFullYear()): Promise<YearInReviewResponse> {
    return this.api.get<YearInReviewResponse>(`/api/stats/year-in-review/${year}`);
  }
}
