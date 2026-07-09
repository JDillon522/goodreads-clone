import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { StatsSummaryResponse, YearInReviewResponse } from '../../core/api/api.types';
import { Stats as StatsService } from '../../core/stats/stats';

/**
 * Stats route for current-year reading summary and year-in-review highlights.
 */
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
  protected readonly summary = computed<StatsSummaryResponse | null>(
    () => this.review()?.summary ?? null,
  );
  /**
   * Loads the current year's review payload when the route opens.
   */
  public constructor() {
    void this.loadStats(this.currentYear);
  }
  /**
   * Formats average rating with one decimal or a no-rating fallback.
   */
  protected averageRating(): string {
    const rating = this.summary()?.totals.averageRating;

    return typeof rating === 'number' ? rating.toFixed(1) : 'None';
  }
  /**
   * Converts a monthly value to a visible bar width with a small nonzero floor.
   */
  protected barSize(value: number, max: number): string {
    if (value <= 0 || max <= 0) {
      return '0%';
    }

    return `${Math.max(8, Math.round((value / max) * 100))}%`;
  }
  /**
   * Formats best month label for display while keeping templates free of presentation logic.
   */
  protected bestMonthLabel(): string {
    const bestMonth = this.review()?.highlights.bestMonth;

    return bestMonth ? `${bestMonth.label} · ${bestMonth.booksCompleted}` : 'None yet';
  }
  /**
   * Formats number for display while keeping templates free of presentation logic.
   */
  protected formatNumber(value: null | number | undefined): string {
    return this.numberFormatter.format(value ?? 0);
  }
  /**
   * Formats goal pace label for display while keeping templates free of presentation logic.
   */
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
  /**
   * Finds the largest monthly completion count for proportional chart bars.
   */
  protected maxMonthlyBooks(): number {
    return Math.max(
      0,
      ...(this.summary()?.monthlyCompletions.map((month) => month.booksCompleted) ?? []),
    );
  }
  /**
   * Shows the top author highlight or the empty-state fallback.
   */
  protected topAuthorLabel(): string {
    return this.review()?.highlights.topAuthor?.name ?? 'No author yet';
  }
  /**
   * Shows the top genre highlight or the empty-state fallback.
   */
  protected topGenreLabel(): string {
    return this.review()?.highlights.topGenre?.name ?? 'No genre yet';
  }
  /**
   * Loads the review payload used by all stats cards and charts.
   */
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
