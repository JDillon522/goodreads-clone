import { PrismaPg } from '@prisma/adapter-pg';
import { BookProvider, GoogleBooksSyncStatus, PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { encode } from 'jpeg-js';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../../.env') });

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
    id: string;
    summary: {
      googleBooksVolumeId: null | string;
      pageCount: null | number;
    };
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

type BookMetadataResponse = {
  google: Record<string, unknown> | null;
  id: string;
  summary: {
    googleBooksVolumeId: null | string;
    title: string;
  };
};

type RelatedBooksResponse = {
  bookId: string;
  items: { book: { id: string }; score: number }[];
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

type BookshelfPhotoResponse = {
  associatedDetectionCount: number;
  detectionCount: number;
  id: string;
  label: string;
};

/**
 * Builds the default e2e cleanup database URL from the root .env database section.
 */
function databaseUrlFromParts(): string {
  const database = requiredEnv('POSTGRES_DB');
  const schema = process.env.POSTGRES_SCHEMA ?? 'public';
  const user = requiredEnv('POSTGRES_USER');
  const password = requiredEnv('POSTGRES_PASSWORD');
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_HOST_PORT ?? '5432';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=${encodeURIComponent(schema)}`;
}

/**
 * Reads a required root .env value for e2e cleanup setup.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set in the root .env file.`);
  }

  return value;
}

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api';
const cleanupDatabaseUrl = process.env.E2E_CLEANUP_DATABASE_URL ?? databaseUrlFromParts();
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

  it('supports signup, shelf listing, idempotent add book, progress, and goals', async () => {
    const runId = Date.now();
    const email = `e2e-stage8-${runId}@example.com`;
    const isbn13 = `978000${String(runId).slice(-7).padStart(7, '0')}`;
    const isbn10 = `0${String(runId).slice(-9).padStart(9, '0')}`;
    const sourceId = `isbn13:${isbn13}`;
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
    await seedE2eBookCache({
      isbn10,
      isbn13,
      sourceId,
    });

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

    const added = await request<LibraryItemResponse>('/library', {
      body: { isbn10, isbn13, googleBooksVolumeId: `e2e-google-${runId}` },
      method: 'POST',
      token: accessToken,
    });

    expect(added.status).toBe('WANT_TO_READ');
    expect(added.shelves.map((shelf) => shelf.slug)).toEqual(['unshelved']);

    const cachedDetail = await request<BookMetadataResponse>(
      `/books/google/${added.book.summary.googleBooksVolumeId}`,
    );

    expect(cachedDetail.id).toBe(added.book.id);
    expect(cachedDetail.summary.title).toBe('The Left Hand of Darkness');
    expect(cachedDetail).not.toHaveProperty('openLibrary');

    const related = await request<RelatedBooksResponse>(`/books/${added.book.id}/related?limit=1`);

    expect(related.bookId).toBe(added.book.id);
    expect(related.items).toHaveLength(1);

    const duplicateAdd = await request<LibraryItemResponse>('/library', {
      body: { isbn10, isbn13, googleBooksVolumeId: `e2e-google-${runId}` },
      method: 'POST',
      token: accessToken,
    });

    expect(duplicateAdd.id).toBe(added.id);
    expect(duplicateAdd.shelves.map((shelf) => shelf.slug)).toEqual(['unshelved']);

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

    const itemWithPages = library.find((item) => item.book.summary.pageCount);

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

  it('keeps bookshelf photos signed-in-only and persists only an explicit save', async () => {
    const runId = Date.now();
    const email = `e2e-bookshelf-photo-${runId}@example.com`;
    const accessToken = (
      await request<AuthResponse>('/auth/signup', {
        body: {
          displayName: 'Shelf Scanner',
          email,
          password: 'SmokeTest123!',
        },
        method: 'POST',
      })
    ).accessToken;
    createdEmails.push(email);

    const guest = await request<GuestResponse>('/guest/session', { method: 'POST' });
    createdGuestSessionIds.push(guest.sessionId);
    await requestExpect('/bookshelf-photos', 401, { token: guest.guestToken });
    await requestExpect('/bookshelf-scans/analyze', 400, {
      method: 'POST',
      token: accessToken,
    });

    const pixels = Buffer.alloc(12 * 8 * 4, 80);
    const jpeg = encode({ data: pixels, height: 8, width: 12 }, 80).data;
    const upload = new FormData();
    upload.append('image', new Blob([Uint8Array.from(jpeg)], { type: 'image/jpeg' }), 'shelf.jpg');
    upload.append('label', 'E2E office shelf');
    upload.append(
      'manifest',
      JSON.stringify({
        detections: [
          {
            boundingBox: { height: 800, rotationDegrees: 0, width: 100, x: 100, y: 50 },
            confidence: 75,
            libraryItemId: null,
            observedAuthors: [],
            observedIsbn10: null,
            observedIsbn13: null,
            observedPublisher: null,
            observedSpineText: 'UNRESOLVED TEST SPINE',
            observedTitle: null,
            position: 0,
            selectedGoogleBooksVolumeId: null,
          },
        ],
      }),
    );

    const savedResponse = await fetch(`${apiBaseUrl}/bookshelf-photos`, {
      body: upload,
      headers: { authorization: `Bearer ${accessToken}` },
      method: 'POST',
    });
    const savedText = await savedResponse.text();
    if (savedResponse.status !== 201) {
      throw new Error(`Photo save failed ${savedResponse.status}: ${savedText}`);
    }
    const saved = JSON.parse(savedText) as BookshelfPhotoResponse;
    expect(saved).toEqual(
      expect.objectContaining({
        associatedDetectionCount: 0,
        detectionCount: 1,
        label: 'E2E office shelf',
      }),
    );

    const photos = await request<BookshelfPhotoResponse[]>('/bookshelf-photos', {
      token: accessToken,
    });
    expect(photos.map((photo) => photo.id)).toContain(saved.id);

    const image = await fetch(`${apiBaseUrl}/bookshelf-photos/${saved.id}/thumbnail`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/webp');
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const renamed = await request<BookshelfPhotoResponse>(`/bookshelf-photos/${saved.id}`, {
      body: { label: 'Renamed E2E shelf' },
      method: 'PATCH',
      token: accessToken,
    });
    expect(renamed.label).toBe('Renamed E2E shelf');

    await request<void>(`/bookshelf-photos/${saved.id}`, {
      method: 'DELETE',
      token: accessToken,
    });
    await requestExpect(`/bookshelf-photos/${saved.id}`, 404, { token: accessToken });
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
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function seedE2eBookCache(input: {
  isbn10: string;
  isbn13: string;
  sourceId: string;
}): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(cleanupDatabaseUrl),
  });

  try {
    await prisma.book.upsert({
      create: {
        googleBooksRawPayload: {
          accessInfo: { viewability: 'NO_PAGES' },
          id: `e2e-google-${input.isbn13}`,
          volumeInfo: {
            authors: ['Ursula K. Le Guin'],
            categories: ['Science fiction'],
            industryIdentifiers: [
              { identifier: input.isbn10, type: 'ISBN_10' },
              { identifier: input.isbn13, type: 'ISBN_13' },
            ],
            pageCount: 304,
            publishedDate: '1969',
            publisher: 'Ace Books',
            title: 'The Left Hand of Darkness',
          },
        },
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: `e2e-google-${input.isbn13}`,
        isbn10: input.isbn10,
        isbn13: input.isbn13,
        normalizedPrimaryAuthor: 'ursula k le guin',
        normalizedTitle: 'the left hand of darkness',
        sourceId: input.sourceId,
        sourceProvider: BookProvider.GOOGLE_BOOKS,
      },
      update: {
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
      },
      where: {
        sourceProvider_sourceId: {
          sourceId: input.sourceId,
          sourceProvider: BookProvider.GOOGLE_BOOKS,
        },
      },
    });
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
