import { PrismaPg } from '@prisma/adapter-pg';
import { BookProvider, PrismaClient } from '@prisma/client';

type JsonBody = Record<string, unknown>;

type AuthResponse = {
  accessToken: string;
};

type GuestResponse = {
  guestToken: string;
  sessionId: string;
};

type ShelfResponse = {
  id: string;
  name: string;
  slug: string;
};

type LibraryItemResponse = {
  book: {
    pageCount: null | number;
  };
  currentPage: null | number;
  currentPercent: null | number;
  id: string;
  rating: null | number;
  status: 'READ' | 'READING' | 'WANT_TO_READ';
  shelves: {
    id: string;
    slug: string;
  }[];
};

type DeleteShelfResponse = {
  affectedBooks: {
    libraryItemId: string;
    shelves: {
      id: string;
      name: string;
      slug: string;
    }[];
    title: string;
  }[];
  deletedShelfName: string;
  fallbackShelfId: null | string;
};

type GoalResponse = {
  completedAt: null | string;
  stats: {
    completedBooks: number;
    isComplete: boolean;
  };
};

type StatsSummaryResponse = {
  authors: { count: number; name: string }[];
  genres: { count: number; name: string }[];
  pages: {
    estimatedPagesRead: number;
  };
  topRatedBooks: {
    rating: null | number;
    title: string;
  }[];
  totals: {
    booksCompleted: number;
    totalLibraryBooks: number;
  };
  year: number;
};

type YearInReviewResponse = {
  highlights: {
    hasCompletedBooks: boolean;
    topAuthor: null | { name: string };
    topGenre: null | { name: string };
  };
  summary: StatsSummaryResponse;
  year: number;
};

type SessionStatusResponse = {
  authenticated: true;
  ownerType: 'GUEST' | 'USER';
};

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api';
const cleanupDatabaseUrl =
  process.env.E2E_CLEANUP_DATABASE_URL ??
  'postgresql://bookshelf:bookshelf@localhost:5433/bookshelf?schema=public';
const createdEmails: string[] = [];
const createdGuestSessionIds: string[] = [];
const createdSourceIds: string[] = [];

jest.setTimeout(30_000);

describe('Bookshelf API workflows', () => {
  afterAll(async () => {
    await cleanupE2eData();
  });

  it('rejects session status requests without a user or guest token', async () => {
    await requestExpect('/session/status', 401);
  });

  it('supports signup, shelf listing, add book, duplicate rejection, progress, and goals', async () => {
    const runId = Date.now();
    const email = `e2e-stage8-${runId}@example.com`;
    const sourceId = `e2e:${runId}`;
    const accessToken = (
      await request<AuthResponse>('/auth/signup', {
        body: {
          displayName: 'E2E Reader',
          email,
          password: 'SmokeTest123!',
        },
        method: 'POST',
      })
    ).accessToken;

    createdEmails.push(email);
    createdSourceIds.push(sourceId);

    const shelves = await request<ShelfResponse[]>('/shelves', { token: accessToken });
    const sessionStatus = await request<SessionStatusResponse>('/session/status', {
      token: accessToken,
    });

    expect(sessionStatus).toEqual({
      authenticated: true,
      ownerType: 'USER',
    });

    expect(shelves.map((shelf) => shelf.slug)).toEqual([
      'unshelved',
      'want-to-read',
      'currently-reading',
      'read',
    ]);
    const unshelved = shelves.find((shelf) => shelf.slug === 'unshelved');
    const wantToRead = shelves.find((shelf) => shelf.slug === 'want-to-read');

    expect(unshelved).toBeDefined();
    expect(wantToRead).toBeDefined();

    await requestExpect(`/shelves/${unshelved?.id}`, 400, {
      method: 'DELETE',
      token: accessToken,
    });

    const deleteWantToRead = await request<DeleteShelfResponse>(`/shelves/${wantToRead?.id}`, {
      method: 'DELETE',
      token: accessToken,
    });

    expect(deleteWantToRead.deletedShelfName).toBe('Want to Read');

    const book = {
      authors: ['Ursula K. Le Guin'],
      coverUrl: null,
      dedupeKey: sourceId,
      description: null,
      genres: ['Science fiction'],
      isbn10: null,
      isbn13: null,
      openLibraryEditionKey: null,
      openLibraryWorkKey: '/works/OL262758W',
      pageCount: 304,
      primaryAuthor: 'Ursula K. Le Guin',
      provider: 'OPEN_LIBRARY',
      providerKey: sourceId,
      publishedDate: '1969',
      publisher: 'Ace Books',
      sourceId,
      sourceUrl: 'https://openlibrary.org/works/OL262758W',
      subtitle: null,
      title: 'The Left Hand of Darkness',
    };
    const added = await request<LibraryItemResponse>('/library', {
      body: { book },
      method: 'POST',
      token: accessToken,
    });

    expect(added.status).toBe('WANT_TO_READ');
    expect(added.shelves.map((shelf) => shelf.slug)).toEqual(['unshelved']);

    await requestExpect('/library', 409, {
      body: { book },
      method: 'POST',
      token: accessToken,
    });

    const manuallyRead = await request<LibraryItemResponse>(`/library/${added.id}`, {
      body: { status: 'READ' },
      method: 'PATCH',
      token: accessToken,
    });

    expect(manuallyRead.status).toBe('READ');
    expect(manuallyRead.currentPercent).toBeNull();

    const partialAfterRead = await request<LibraryItemResponse>(`/library/${added.id}/progress`, {
      body: { currentPage: 152, trackingMode: 'PAGE' },
      method: 'POST',
      token: accessToken,
    });

    expect(partialAfterRead.currentPercent).toBe(50);
    expect(partialAfterRead.status).toBe('READ');

    const progressed = await request<LibraryItemResponse>(`/library/${added.id}/progress`, {
      body: { currentPage: 304, trackingMode: 'PAGE' },
      method: 'POST',
      token: accessToken,
    });

    expect(progressed.currentPercent).toBe(100);
    expect(progressed.status).toBe('READ');
    expect(progressed.shelves.map((shelf) => shelf.slug)).toEqual(['unshelved']);

    const reviewed = await request<LibraryItemResponse>(`/library/${added.id}`, {
      body: { rating: 5, notes: 'A classic.' },
      method: 'PATCH',
      token: accessToken,
    });

    expect(reviewed.rating).toBe(5);

    const multiShelf = await request<ShelfResponse>('/shelves', {
      body: { name: `SciFi ${runId}` },
      method: 'POST',
      token: accessToken,
    });
    const onMultipleShelves = await request<LibraryItemResponse>(`/library/${added.id}/shelves`, {
      body: { shelfId: multiShelf.id },
      method: 'POST',
      token: accessToken,
    });

    expect(onMultipleShelves.shelves.map((shelf) => shelf.slug).sort()).toEqual([
      multiShelf.slug,
      'unshelved',
    ]);

    const deleteMultiShelf = await request<DeleteShelfResponse>(`/shelves/${multiShelf.id}`, {
      method: 'DELETE',
      token: accessToken,
    });

    expect(deleteMultiShelf.affectedBooks).toHaveLength(1);
    expect(deleteMultiShelf.affectedBooks[0].shelves.map((shelf) => shelf.slug)).toEqual([
      'unshelved',
    ]);

    const onlyShelf = await request<ShelfResponse>('/shelves', {
      body: { name: `Only Shelf ${runId}` },
      method: 'POST',
      token: accessToken,
    });
    await request<LibraryItemResponse>(`/library/${added.id}/shelves`, {
      body: { shelfId: onlyShelf.id },
      method: 'POST',
      token: accessToken,
    });
    await request<LibraryItemResponse>(`/library/${added.id}/shelves/${added.shelves[0].id}`, {
      method: 'DELETE',
      token: accessToken,
    });

    const deleteOnlyShelf = await request<DeleteShelfResponse>(`/shelves/${onlyShelf.id}`, {
      method: 'DELETE',
      token: accessToken,
    });

    expect(deleteOnlyShelf.fallbackShelfId).toEqual(expect.any(String));
    expect(deleteOnlyShelf.affectedBooks[0].shelves.map((shelf) => shelf.slug)).toEqual([
      'unshelved',
    ]);

    const goal = await request<GoalResponse>(`/goals/${new Date().getUTCFullYear()}`, {
      body: { targetBooks: 1 },
      method: 'PUT',
      token: accessToken,
    });

    expect(goal.stats.completedBooks).toBeGreaterThanOrEqual(1);
    expect(goal.stats.isComplete).toBe(true);
    expect(goal.completedAt).toEqual(expect.any(String));

    const stats = await request<StatsSummaryResponse>(
      `/stats/summary?year=${new Date().getUTCFullYear()}`,
      {
        token: accessToken,
      },
    );

    expect(stats.totals.booksCompleted).toBeGreaterThanOrEqual(1);
    expect(stats.pages.estimatedPagesRead).toBeGreaterThanOrEqual(304);
    expect(stats.genres.map((genre) => genre.name)).toContain('Science fiction');
    expect(stats.authors.map((author) => author.name)).toContain('Ursula K. Le Guin');
    expect(stats.topRatedBooks[0]).toEqual(expect.objectContaining({ rating: 5 }));

    const review = await request<YearInReviewResponse>(
      `/stats/year-in-review/${new Date().getUTCFullYear()}`,
      {
        token: accessToken,
      },
    );

    expect(review.highlights.hasCompletedBooks).toBe(true);
    expect(review.highlights.topAuthor?.name).toBe('Ursula K. Le Guin');
    expect(review.highlights.topGenre?.name).toBe('Science fiction');
  });

  it('creates a guest session that can use the same shelf, library, progress, and goal APIs', async () => {
    const guest = await request<GuestResponse>('/guest/session', { method: 'POST' });

    createdGuestSessionIds.push(guest.sessionId);

    const shelves = await request<ShelfResponse[]>('/shelves', { token: guest.guestToken });
    const library = await request<LibraryItemResponse[]>('/library', { token: guest.guestToken });
    const sessionStatus = await request<SessionStatusResponse>('/session/status', {
      token: guest.guestToken,
    });

    expect(sessionStatus).toEqual({
      authenticated: true,
      ownerType: 'GUEST',
    });
    expect(shelves.map((shelf) => shelf.slug)).toEqual([
      'unshelved',
      'want-to-read',
      'currently-reading',
      'read',
    ]);
    expect(library.length).toBeGreaterThanOrEqual(12);

    const itemWithPages = library.find((item) => item.book.pageCount);

    expect(itemWithPages).toBeDefined();

    const progressed = await request<LibraryItemResponse>(
      `/library/${itemWithPages?.id}/progress`,
      {
        body: { currentPage: 1, trackingMode: 'PAGE' },
        method: 'POST',
        token: guest.guestToken,
      },
    );

    expect(progressed.currentPage).toBe(1);
    expect(progressed.status).toBe('READING');
    expect(progressed.shelves.length).toBeGreaterThanOrEqual(1);

    const goal = await request<GoalResponse>('/goals/current', { token: guest.guestToken });

    expect(goal.stats.completedBooks).toBeGreaterThanOrEqual(0);

    const stats = await request<StatsSummaryResponse>(
      `/stats/summary?year=${new Date().getUTCFullYear()}`,
      {
        token: guest.guestToken,
      },
    );

    expect(stats.year).toBe(new Date().getUTCFullYear());
    expect(stats.totals.totalLibraryBooks).toBeGreaterThanOrEqual(12);
    expect(stats.pages.estimatedPagesRead).toBeGreaterThanOrEqual(0);
  });

  it('prevents one guest session from reading another guest session library item', async () => {
    const firstGuest = await request<GuestResponse>('/guest/session', { method: 'POST' });
    const secondGuest = await request<GuestResponse>('/guest/session', { method: 'POST' });

    createdGuestSessionIds.push(firstGuest.sessionId, secondGuest.sessionId);

    const firstGuestLibrary = await request<LibraryItemResponse[]>('/library', {
      token: firstGuest.guestToken,
    });

    expect(firstGuestLibrary.length).toBeGreaterThan(0);

    await requestExpect(`/library/${firstGuestLibrary[0].id}`, 404, {
      token: secondGuest.guestToken,
    });
  });
});

async function cleanupE2eData(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(cleanupDatabaseUrl),
  });

  try {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: createdEmails,
          },
        },
      });
    }

    if (createdGuestSessionIds.length > 0) {
      await prisma.guestSession.deleteMany({
        where: {
          id: {
            in: createdGuestSessionIds,
          },
        },
      });
    }

    if (createdSourceIds.length > 0) {
      await prisma.book.deleteMany({
        where: {
          sourceId: {
            in: createdSourceIds,
          },
          sourceProvider: BookProvider.OPEN_LIBRARY,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function request<T>(
  path: string,
  options: {
    body?: JsonBody;
    method?: string;
    token?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method ?? 'GET',
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed ${response.status}: ${text}`);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function requestExpect(
  path: string,
  status: number,
  options: {
    body?: JsonBody;
    method?: string;
    token?: string;
  } = {},
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method ?? 'GET',
  });

  expect(response.status).toBe(status);
}
