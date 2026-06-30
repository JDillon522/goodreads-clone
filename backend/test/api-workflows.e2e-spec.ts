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
  slug: string;
};

type LibraryItemResponse = {
  book: {
    pageCount: null | number;
  };
  currentPage: null | number;
  currentPercent: null | number;
  id: string;
  shelf: {
    slug: string;
  };
};

type GoalResponse = {
  completedAt: null | string;
  stats: {
    completedBooks: number;
    isComplete: boolean;
  };
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
    expect(shelves.map((shelf) => shelf.slug)).toEqual([
      'want-to-read',
      'currently-reading',
      'read',
    ]);

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

    await requestExpect('/library', 409, {
      body: { book },
      method: 'POST',
      token: accessToken,
    });

    const progressed = await request<LibraryItemResponse>(`/library/${added.id}/progress`, {
      body: { currentPage: 304, trackingMode: 'PAGE' },
      method: 'POST',
      token: accessToken,
    });

    expect(progressed.currentPercent).toBe(100);
    expect(progressed.shelf.slug).toBe('read');

    const goal = await request<GoalResponse>(`/goals/${new Date().getUTCFullYear()}`, {
      body: { targetBooks: 1 },
      method: 'PUT',
      token: accessToken,
    });

    expect(goal.stats.completedBooks).toBeGreaterThanOrEqual(1);
    expect(goal.stats.isComplete).toBe(true);
    expect(goal.completedAt).toEqual(expect.any(String));
  });

  it('creates a guest session that can use the same shelf, library, progress, and goal APIs', async () => {
    const guest = await request<GuestResponse>('/guest/session', { method: 'POST' });

    createdGuestSessionIds.push(guest.sessionId);

    const shelves = await request<ShelfResponse[]>('/shelves', { token: guest.guestToken });
    const library = await request<LibraryItemResponse[]>('/library', { token: guest.guestToken });

    expect(shelves.map((shelf) => shelf.slug)).toEqual([
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
    expect(progressed.shelf.slug).toBe('currently-reading');

    const goal = await request<GoalResponse>('/goals/current', { token: guest.guestToken });

    expect(goal.stats.completedBooks).toBeGreaterThanOrEqual(0);
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
