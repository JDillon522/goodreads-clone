import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { YearInReviewResponse } from '../../core/api/api.types';
import { Stats as StatsService } from '../../core/stats/stats';
import { Stats } from './stats';

const timestamp = '2026-07-08T12:00:00.000Z';

const review: YearInReviewResponse = {
  generatedAt: timestamp,
  highlights: {
    bestMonth: { booksCompleted: 3, estimatedPagesRead: 900, label: 'Jun', month: 6 },
    hasCompletedBooks: true,
    longestBook: {
      coverUrl: null,
      dateFinished: timestamp,
      estimatedPages: 720,
      id: 'book-2',
      pageCount: 720,
      primaryAuthor: 'N. K. Jemisin',
      rating: 4,
      title: 'Long Book',
    },
    topAuthor: { count: 2, name: 'Ursula K. Le Guin' },
    topGenre: { count: 4, name: 'Fantasy' },
    topRatedBook: {
      coverUrl: null,
      dateFinished: timestamp,
      estimatedPages: 304,
      id: 'book-1',
      pageCount: 304,
      primaryAuthor: 'Ursula K. Le Guin',
      rating: 5,
      title: 'The Left Hand of Darkness',
    },
  },
  summary: {
    authors: [{ count: 2, name: 'Ursula K. Le Guin' }],
    generatedAt: timestamp,
    genres: [{ count: 4, name: 'Fantasy' }],
    goal: {
      completedAt: null,
      stats: {
        booksBehindPace: 0,
        completedBooks: 12,
        daysElapsed: 190,
        daysRemaining: 175,
        expectedCompletedByToday: 6.2,
        isComplete: false,
        isOnTrack: true,
        percentComplete: 75,
        remainingBooks: 4,
      },
      targetBooks: 16,
    },
    longestCompletedBook: {
      coverUrl: null,
      dateFinished: timestamp,
      estimatedPages: 720,
      id: 'book-2',
      pageCount: 720,
      primaryAuthor: 'N. K. Jemisin',
      rating: 4,
      title: 'Long Book',
    },
    monthlyCompletions: [
      { booksCompleted: 0, estimatedPagesRead: 0, label: 'Jan', month: 1 },
      { booksCompleted: 3, estimatedPagesRead: 900, label: 'Jun', month: 6 },
    ],
    pages: {
      averagePagesPerKnownCompletedBook: 283,
      estimatedMissingPageBooks: 1,
      estimatedPagesInProgress: 420,
      estimatedPagesRead: 3400,
      knownCompletedPages: 3117,
    },
    shelves: [{ count: 12, id: 'read', name: 'Read', slug: 'read' }],
    statuses: [
      { count: 12, status: 'READ' },
      { count: 2, status: 'READING' },
      { count: 8, status: 'WANT_TO_READ' },
    ],
    topRatedBooks: [
      {
        coverUrl: null,
        dateFinished: timestamp,
        estimatedPages: 304,
        id: 'book-1',
        pageCount: 304,
        primaryAuthor: 'Ursula K. Le Guin',
        rating: 5,
        title: 'The Left Hand of Darkness',
      },
    ],
    totals: {
      activityEvents: 20,
      averageRating: 4.4,
      booksCompleted: 12,
      booksInProgress: 2,
      booksReadAllTime: 12,
      booksWantToRead: 8,
      progressUpdates: 14,
      ratedBooks: 9,
      totalLibraryBooks: 22,
    },
    year: new Date().getFullYear(),
  },
  year: new Date().getFullYear(),
};

class MockStatsService {
  public readonly yearInReview = vi.fn(async () => review);
}

describe('Stats route', () => {
  let fixture: ComponentFixture<Stats>;
  let statsService: MockStatsService;

  beforeEach(async () => {
    statsService = new MockStatsService();

    await TestBed.configureTestingModule({
      imports: [Stats],
      providers: [provideRouter([]), { provide: StatsService, useValue: statsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(Stats);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the current-year review and renders headline stats', async () => {
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(statsService.yearInReview).toHaveBeenCalledWith(new Date().getFullYear());
    expect(text).toContain(`${new Date().getFullYear()} reading stats`);
    expect(text).toContain('12');
    expect(text).toContain('3,400');
    expect(text).toContain('Fantasy');
    expect(text).toContain('Ursula K. Le Guin');
    expect(text).toContain('The Left Hand of Darkness');
  });
});
