import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { StatsSummaryResponse, YearInReviewResponse } from '../../core/api/api.types';
import { Stats as StatsService } from '../../core/stats/stats';

@Component({
  selector: 'app-stats',
  imports: [RouterLink],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stats {
  private readonly stats = inject(StatsService);
  private readonly numberFormatter = new Intl.NumberFormat('en-US');
  protected readonly currentYear = new Date().getFullYear();
  protected readonly review = signal<YearInReviewResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = computed<StatsSummaryResponse | null>(() => this.review()?.summary ?? null);

  public constructor() {
    void this.loadStats(this.currentYear);
  }

  protected averageRating(): string {
    const rating = this.summary()?.totals.averageRating;

    return typeof rating === 'number' ? rating.toFixed(1) : 'None';
  }

  protected barSize(value: number, max: number): string {
    if (value <= 0 || max <= 0) {
      return '0%';
    }

    return `${Math.max(8, Math.round((value / max) * 100))}%`;
  }

  protected bestMonthLabel(): string {
    const bestMonth = this.review()?.highlights.bestMonth;

    return bestMonth ? `${bestMonth.label} · ${bestMonth.booksCompleted}` : 'None yet';
  }

  protected formatNumber(value: null | number | undefined): string {
    return this.numberFormatter.format(value ?? 0);
  }

  protected goalPaceLabel(): string {
    const goal = this.summary()?.goal.stats;

    if (!goal) {
      return 'No goal';
    }

    if (goal.isComplete) {
      return 'Complete';
    }

    return goal.isOnTrack ? 'On track' : `${goal.booksBehindPace} behind`;
  }

  protected maxMonthlyBooks(): number {
    return Math.max(0, ...(this.summary()?.monthlyCompletions.map((month) => month.booksCompleted) ?? []));
  }

  protected topAuthorLabel(): string {
    return this.review()?.highlights.topAuthor?.name ?? 'No author yet';
  }

  protected topGenreLabel(): string {
    return this.review()?.highlights.topGenre?.name ?? 'No genre yet';
  }

  private async loadStats(year: number): Promise<void> {
    try {
      this.review.set(await this.stats.yearInReview(year));
    } catch {
      this.error.set('Stats could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
