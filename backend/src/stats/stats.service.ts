import { Injectable } from '@nestjs/common';
import { LibraryItemStatus, Prisma } from '@prisma/client';

import { bookSummary, type BookMetadataRecord } from '../books/book-metadata.mapper';
import { BookPersistenceService } from '../books/book-persistence.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { calculateGoalStats } from '../goals/goal-rules';
import {
  StatsBookHighlightResponseDto,
  StatsMonthlyCompletionResponseDto,
  StatsShelfBreakdownResponseDto,
  StatsStatusBreakdownResponseDto,
  StatsSummaryResponseDto,
} from './dto/stats-summary-response.dto';
import { YearInReviewResponseDto } from './dto/year-in-review-response.dto';
import { calculateCompletedPageEstimate, estimateProgressPages, rankValues } from './stats-rules';

/**
 * Computes dashboard and year-in-review statistics from library, shelf, progress, goal, and
 * activity data. Page totals are estimates when books are missing page counts.
 */
const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const statsLibraryItemInclude = {
  shelves: {
    include: {
      shelf: true,
    },
  },
} satisfies Prisma.LibraryItemInclude;

type StatsLibraryItemBase = Prisma.LibraryItemGetPayload<{
  include: typeof statsLibraryItemInclude;
}>;
type StatsBook = Awaited<ReturnType<BookPersistenceService['ensureBookForIdentity']>>;
type StatsLibraryItem = StatsLibraryItemBase & { book: StatsBook };

type StatsShelf = Prisma.ShelfGetPayload<Record<string, never>>;

@Injectable()
export class StatsService {
  /**
   * Receives Prisma from Nest.
   */
  public constructor(
    private readonly bookPersistence: BookPersistenceService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Builds the stats summary for one owner and calendar year, including all-time status totals and
   * year-scoped completion, goal, progress, and activity metrics.
   */
  public async getSummary(
    owner: OwnerContext,
    year = new Date().getUTCFullYear(),
  ): Promise<StatsSummaryResponseDto> {
    const { end, start } = this.yearBounds(year);
    const [items, shelves, goal, progressUpdates, activityEvents] = await Promise.all([
      this.prisma.libraryItem.findMany({
        include: statsLibraryItemInclude,
        where: this.ownerWhere(owner),
      }),
      this.prisma.shelf.findMany({
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        where: {
          ...this.ownerWhere(owner),
          deactivatedAt: null,
        },
      }),
      this.prisma.readingGoal.findFirst({
        where: {
          ...this.ownerWhere(owner),
          year,
        },
      }),
      this.prisma.readingProgressEntry.count({
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
          libraryItem: this.ownerWhere(owner),
        },
      }),
      this.prisma.activityEvent.count({
        where: {
          ...this.ownerWhere(owner),
          occurredAt: {
            gte: start,
            lt: end,
          },
        },
      }),
    ]);
    const resolvedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        book: await this.bookPersistence.ensureBookForIdentity({
          isbn10: item.isbn10,
          isbn13: item.isbn13,
        }),
      })),
    );
    const generatedAt = new Date();
    const completed = resolvedItems.filter((item) => this.isFinishedInYear(item, start, end));
    // Some Google Books records do not have page counts. The estimate keeps totals useful by using
    // known completed books to fill in unknown completed-book page totals.
    const completedPageEstimate = calculateCompletedPageEstimate(
      completed.map((item) => ({
        currentPage: item.currentPage,
        pageCount: this.bookSummary(item).pageCount,
      })),
    );
    const estimatedPagesInProgress = resolvedItems
      .filter((item) => item.status === LibraryItemStatus.READING && !item.dateFinished)
      .reduce((total, item) => total + this.estimateProgressPagesForItem(item), 0);
    const ratedCompleted = completed.filter((item) => typeof item.rating === 'number');
    const topRatedBooks = this.topRatedBooks(
      completed,
      completedPageEstimate.averagePagesPerKnownCompletedBook,
    );
    const monthlyCompletions = this.monthlyCompletions(
      completed,
      completedPageEstimate.averagePagesPerKnownCompletedBook,
    );
    const goalTarget = goal?.targetBooks ?? 12;
    const goalStats = calculateGoalStats({
      completedBooks: completed.length,
      now: generatedAt,
      targetBooks: goalTarget,
      year,
    });

    return {
      authors: rankValues(completed.map((item) => this.primaryAuthor(item)).filter(Boolean), 8),
      generatedAt: generatedAt.toISOString(),
      genres: rankValues(
        completed.flatMap((item) => this.bookSummary(item).genres),
        8,
      ),
      goal: {
        completedAt: goal?.completedAt?.toISOString() ?? null,
        stats: goalStats,
        targetBooks: goalTarget,
      },
      longestCompletedBook: this.longestCompletedBook(
        completed,
        completedPageEstimate.averagePagesPerKnownCompletedBook,
      ),
      monthlyCompletions,
      pages: {
        ...completedPageEstimate,
        estimatedPagesInProgress,
      },
      shelves: this.shelfBreakdown(resolvedItems, shelves),
      statuses: this.statusBreakdown(resolvedItems),
      topRatedBooks,
      totals: {
        activityEvents,
        averageRating: this.averageRating(ratedCompleted),
        booksCompleted: completed.length,
        booksInProgress: resolvedItems.filter((item) => item.status === LibraryItemStatus.READING)
          .length,
        booksReadAllTime: resolvedItems.filter((item) => item.status === LibraryItemStatus.READ)
          .length,
        booksWantToRead: resolvedItems.filter(
          (item) => item.status === LibraryItemStatus.WANT_TO_READ,
        ).length,
        progressUpdates,
        ratedBooks: ratedCompleted.length,
        totalLibraryBooks: resolvedItems.length,
      },
      year,
    };
  }
  /**
   * Wraps the stats summary with highlight picks suitable for a year-in-review page.
   */
  public async getYearInReview(
    owner: OwnerContext,
    year: number,
  ): Promise<YearInReviewResponseDto> {
    const summary = await this.getSummary(owner, year);

    return {
      generatedAt: summary.generatedAt,
      highlights: {
        bestMonth: this.bestMonth(summary.monthlyCompletions),
        hasCompletedBooks: summary.totals.booksCompleted > 0,
        longestBook: summary.longestCompletedBook,
        topAuthor: summary.authors[0] ?? null,
        topGenre: summary.genres[0] ?? null,
        topRatedBook: summary.topRatedBooks[0] ?? null,
      },
      summary,
      year,
    };
  }
  /**
   * Returns the one-decimal average rating for completed, rated books.
   */
  private averageRating(items: StatsLibraryItem[]): null | number {
    if (items.length === 0) {
      return null;
    }

    const total = items.reduce((sum, item) => sum + (item.rating ?? 0), 0);

    return Math.round((total / items.length) * 10) / 10;
  }
  /**
   * Selects the strongest month by completed books, using estimated pages as the tie-breaker.
   */
  private bestMonth(
    monthlyCompletions: StatsMonthlyCompletionResponseDto[],
  ): null | StatsMonthlyCompletionResponseDto {
    const best = monthlyCompletions.reduce<StatsMonthlyCompletionResponseDto | null>(
      (currentBest, month) => {
        if (month.booksCompleted === 0) {
          return currentBest;
        }

        if (!currentBest) {
          return month;
        }

        if (month.booksCompleted > currentBest.booksCompleted) {
          return month;
        }

        if (
          month.booksCompleted === currentBest.booksCompleted &&
          month.estimatedPagesRead > currentBest.estimatedPagesRead
        ) {
          return month;
        }

        return currentBest;
      },
      null,
    );

    return best;
  }
  /**
   * Estimates completed pages for a book using page count first, then final current page, then the
   * summary-level fallback average.
   */
  private estimatedCompletedPagesForItem(item: StatsLibraryItem, fallbackPages: number): number {
    const pageCount = this.bookSummary(item).pageCount;

    if (typeof pageCount === 'number' && pageCount > 0) {
      return pageCount;
    }

    if (typeof item.currentPage === 'number' && item.currentPage > 0) {
      return item.currentPage;
    }

    return fallbackPages;
  }
  /**
   * Estimates pages read for an in-progress item from page or percent progress.
   */
  private estimateProgressPagesForItem(item: StatsLibraryItem): number {
    return estimateProgressPages({
      currentPage: item.currentPage,
      currentPercent: this.numberFromDecimal(item.currentPercent),
      pageCount: this.bookSummary(item).pageCount,
    });
  }
  /**
   * Checks whether an item completed inside the UTC year window.
   */
  private isFinishedInYear(item: StatsLibraryItem, start: Date, end: Date): boolean {
    return Boolean(item.dateFinished && item.dateFinished >= start && item.dateFinished < end);
  }
  /**
   * Finds the completed book with the highest estimated page count.
   */
  private longestCompletedBook(
    completed: StatsLibraryItem[],
    fallbackPages: number,
  ): null | StatsBookHighlightResponseDto {
    const longest = [...completed].sort(
      (left, right) =>
        this.estimatedCompletedPagesForItem(right, fallbackPages) -
        this.estimatedCompletedPagesForItem(left, fallbackPages),
    )[0];

    return longest ? this.toBookHighlight(longest, fallbackPages) : null;
  }
  /**
   * Aggregates completed books and estimated pages into fixed Jan-Dec buckets.
   */
  private monthlyCompletions(
    completed: StatsLibraryItem[],
    fallbackPages: number,
  ): StatsMonthlyCompletionResponseDto[] {
    const months = monthLabels.map((label, index) => ({
      booksCompleted: 0,
      estimatedPagesRead: 0,
      label,
      month: index + 1,
    }));

    for (const item of completed) {
      if (!item.dateFinished) {
        continue;
      }

      const month = item.dateFinished.getUTCMonth();
      months[month].booksCompleted += 1;
      months[month].estimatedPagesRead += this.estimatedCompletedPagesForItem(item, fallbackPages);
    }

    return months;
  }
  /**
   * Converts nullable Prisma decimals into nullable JavaScript numbers.
   */
  private numberFromDecimal(value: null | Prisma.Decimal): null | number {
    return value ? value.toNumber() : null;
  }
  /**
   * Converts the current owner context into the shared Prisma ownership predicate.
   */
  private ownerWhere(owner: OwnerContext): ReturnType<typeof ownerRecord> {
    return ownerRecord(owner);
  }
  /**
   * Picks the primary author for ranking and highlight displays.
   */
  private primaryAuthor(item: StatsLibraryItem): string {
    const summary = this.bookSummary(item);

    return summary.primaryAuthor ?? summary.authors[0] ?? '';
  }
  /**
   * Counts active shelf memberships for every library item. Items with no active memberships are
   * counted under Unshelved to match the library response fallback.
   */
  private shelfBreakdown(
    items: StatsLibraryItem[],
    shelves: StatsShelf[],
  ): StatsShelfBreakdownResponseDto[] {
    const unshelved = shelves.find((shelf) => shelf.slug === 'unshelved');
    const counts = new Map<string, StatsShelfBreakdownResponseDto>();

    for (const shelf of shelves) {
      counts.set(shelf.id, {
        count: 0,
        id: shelf.id,
        name: shelf.name,
        slug: shelf.slug,
      });
    }

    for (const item of items) {
      const activeMemberships = item.shelves.filter(
        (membership) => membership.shelf.deactivatedAt === null,
      );

      if (activeMemberships.length === 0) {
        // Deactivated shelves keep their memberships in the database, but stats should show the
        // same effective Unshelved behavior as the rest of the app.
        const key = unshelved?.id ?? 'unshelved';
        const current = counts.get(key) ?? {
          count: 0,
          id: unshelved?.id ?? null,
          name: 'Unshelved',
          slug: 'unshelved',
        };
        current.count += 1;
        counts.set(key, current);
        continue;
      }

      for (const membership of activeMemberships) {
        const current = counts.get(membership.shelf.id) ?? {
          count: 0,
          id: membership.shelf.id,
          name: membership.shelf.name,
          slug: membership.shelf.slug,
        };
        current.count += 1;
        counts.set(membership.shelf.id, current);
      }
    }

    return [...counts.values()].filter((shelf) => shelf.count > 0);
  }
  /**
   * Counts all library items by explicit reading status.
   */
  private statusBreakdown(items: StatsLibraryItem[]): StatsStatusBreakdownResponseDto[] {
    return Object.values(LibraryItemStatus).map((status) => ({
      count: items.filter((item) => item.status === status).length,
      status,
    }));
  }
  /**
   * Maps a library item into the compact highlight card shape used by stats views.
   */
  private toBookHighlight(
    item: StatsLibraryItem,
    fallbackPages: number,
  ): StatsBookHighlightResponseDto {
    const summary = this.bookSummary(item);

    return {
      coverUrl: summary.coverUrl,
      dateFinished: item.dateFinished?.toISOString() ?? null,
      estimatedPages: this.estimatedCompletedPagesForItem(item, fallbackPages),
      id: item.id,
      pageCount: summary.pageCount,
      primaryAuthor: this.primaryAuthor(item) || null,
      rating: item.rating,
      title: summary.title,
    };
  }
  /**
   * Returns up to five completed books sorted by rating, then most recent completion.
   */
  private topRatedBooks(
    completed: StatsLibraryItem[],
    fallbackPages: number,
  ): StatsBookHighlightResponseDto[] {
    return completed
      .filter((item) => typeof item.rating === 'number')
      .sort(
        (left, right) =>
          (right.rating ?? 0) - (left.rating ?? 0) ||
          (right.dateFinished?.getTime() ?? 0) - (left.dateFinished?.getTime() ?? 0),
      )
      .slice(0, 5)
      .map((item) => this.toBookHighlight(item, fallbackPages));
  }
  /**
   * Builds UTC-exclusive year bounds for consistent server-side aggregation.
   */
  private yearBounds(year: number): { end: Date; start: Date } {
    return {
      end: new Date(Date.UTC(year + 1, 0, 1)),
      start: new Date(Date.UTC(year, 0, 1)),
    };
  }

  private bookSummary(item: StatsLibraryItem) {
    return bookSummary(item.book as BookMetadataRecord);
  }
}
