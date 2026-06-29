const { PrismaPg } = require('@prisma/adapter-pg');
const {
  PrismaClient,
  BookProvider,
  ProgressTrackingMode,
  ThemePreference,
} = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://bookshelf:bookshelf@localhost:5432/bookshelf?schema=public';
const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const defaultShelves = [
  { name: 'Want to Read', slug: 'want-to-read', position: 0, isDefault: true },
  { name: 'Currently Reading', slug: 'currently-reading', position: 1, isDefault: true },
  { name: 'Read', slug: 'read', position: 2, isDefault: true },
  { name: 'Favorites', slug: 'favorites', position: 3, isDefault: false },
  { name: 'Book Club', slug: 'book-club', position: 4, isDefault: false },
];

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sourceIdForBook(book) {
  if (book.isbn13) {
    return `isbn13:${book.isbn13}`;
  }

  if (book.isbn10) {
    return `isbn10:${book.isbn10}`;
  }

  return `title-author:${normalizeText(book.title)}:${normalizeText(book.author ?? 'unknown')}`;
}

function dedupeKeyForBook(book) {
  if (book.isbn13) {
    return `isbn13:${book.isbn13}`;
  }

  if (book.isbn10) {
    return `isbn10:${book.isbn10}`;
  }

  return `title-author:${normalizeText(book.title)}:${normalizeText(book.author ?? 'unknown')}`;
}

function shelfSlugForIndex(index) {
  if (index < 15) {
    return 'read';
  }

  if (index < 20) {
    return 'currently-reading';
  }

  if (index < 35) {
    return 'want-to-read';
  }

  if (index < 40) {
    return 'favorites';
  }

  return 'book-club';
}

function dateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

async function main() {
  const sampleBooksPath = path.resolve(__dirname, '../../data/sample-books.json');
  const books = JSON.parse(fs.readFileSync(sampleBooksPath, 'utf8'));
  const year = new Date().getUTCFullYear();

  const guestSession = await prisma.guestSession.upsert({
    where: { tokenHash: 'seed:demo-guest-session' },
    create: {
      tokenHash: 'seed:demo-guest-session',
      label: 'Seeded Guest Demo',
      expiresAt: dateDaysAgo(-30),
    },
    update: {
      label: 'Seeded Guest Demo',
      expiresAt: dateDaysAgo(-30),
      lastSeenAt: new Date(),
    },
  });

  const shelves = {};

  for (const shelf of defaultShelves) {
    shelves[shelf.slug] = await prisma.shelf.upsert({
      where: {
        guestSessionId_slug: {
          guestSessionId: guestSession.id,
          slug: shelf.slug,
        },
      },
      create: {
        guestSessionId: guestSession.id,
        ...shelf,
      },
      update: shelf,
    });
  }

  await prisma.userPreference.upsert({
    where: { guestSessionId: guestSession.id },
    create: {
      guestSessionId: guestSession.id,
      theme: ThemePreference.SYSTEM,
      defaultShelfId: shelves['want-to-read'].id,
    },
    update: {
      theme: ThemePreference.SYSTEM,
      defaultShelfId: shelves['want-to-read'].id,
    },
  });

  await prisma.readingGoal.upsert({
    where: {
      guestSessionId_year: {
        guestSessionId: guestSession.id,
        year,
      },
    },
    create: {
      guestSessionId: guestSession.id,
      year,
      targetBooks: 24,
    },
    update: {
      targetBooks: 24,
    },
  });

  for (const [index, sampleBook] of books.entries()) {
    const normalizedTitle = normalizeText(sampleBook.title);
    const normalizedPrimaryAuthor = sampleBook.author ? normalizeText(sampleBook.author) : null;
    const sourceId = sourceIdForBook(sampleBook);
    const shelfSlug = shelfSlugForIndex(index);
    const shelf = shelves[shelfSlug];
    const isRead = shelfSlug === 'read' || shelfSlug === 'favorites';
    const isCurrentlyReading = shelfSlug === 'currently-reading';

    const book = await prisma.book.upsert({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: BookProvider.SAMPLE,
          sourceId,
        },
      },
      create: {
        sourceProvider: BookProvider.SAMPLE,
        sourceId,
        title: sampleBook.title,
        primaryAuthor: sampleBook.author ?? null,
        authors: sampleBook.author ? [sampleBook.author] : [],
        description: sampleBook.description ?? null,
        publisher: sampleBook.publisher ?? null,
        publishedDate: sampleBook.publishedDate ?? null,
        pageCount: sampleBook.pageCount ?? null,
        coverUrl: sampleBook.coverUrl ?? null,
        isbn10: sampleBook.isbn10 ?? null,
        isbn13: sampleBook.isbn13 ?? null,
        genres: sampleBook.genres ?? [],
        normalizedTitle,
        normalizedPrimaryAuthor,
        rawProviderPayload: sampleBook,
      },
      update: {
        title: sampleBook.title,
        primaryAuthor: sampleBook.author ?? null,
        authors: sampleBook.author ? [sampleBook.author] : [],
        description: sampleBook.description ?? null,
        publisher: sampleBook.publisher ?? null,
        publishedDate: sampleBook.publishedDate ?? null,
        pageCount: sampleBook.pageCount ?? null,
        coverUrl: sampleBook.coverUrl ?? null,
        isbn10: sampleBook.isbn10 ?? null,
        isbn13: sampleBook.isbn13 ?? null,
        genres: sampleBook.genres ?? [],
        normalizedTitle,
        normalizedPrimaryAuthor,
        rawProviderPayload: sampleBook,
      },
    });

    const currentPercent = isCurrentlyReading ? 20 + (index - 15) * 15 : isRead ? 100 : null;
    const currentPage =
      currentPercent !== null && sampleBook.pageCount
        ? Math.min(sampleBook.pageCount, Math.round((sampleBook.pageCount * currentPercent) / 100))
        : null;

    const libraryItem = await prisma.libraryItem.upsert({
      where: {
        guestSessionId_dedupeKey: {
          guestSessionId: guestSession.id,
          dedupeKey: dedupeKeyForBook(sampleBook),
        },
      },
      create: {
        guestSessionId: guestSession.id,
        bookId: book.id,
        shelfId: shelf.id,
        dedupeKey: dedupeKeyForBook(sampleBook),
        rating: isRead ? 3 + (index % 3) : null,
        notes: isRead ? `Seed note for ${sampleBook.title}.` : null,
        currentPage,
        currentPercent,
        progressUpdatedAt: currentPercent !== null ? dateDaysAgo(index + 1) : null,
        dateAdded: dateDaysAgo(90 - index),
        dateFinished: isRead ? dateDaysAgo(60 - index) : null,
      },
      update: {
        bookId: book.id,
        shelfId: shelf.id,
        rating: isRead ? 3 + (index % 3) : null,
        notes: isRead ? `Seed note for ${sampleBook.title}.` : null,
        currentPage,
        currentPercent,
        progressUpdatedAt: currentPercent !== null ? dateDaysAgo(index + 1) : null,
        dateFinished: isRead ? dateDaysAgo(60 - index) : null,
      },
    });

    if (isCurrentlyReading) {
      await prisma.readingProgressEntry.deleteMany({
        where: { libraryItemId: libraryItem.id },
      });
      await prisma.readingProgressEntry.create({
        data: {
          libraryItemId: libraryItem.id,
          trackingMode: sampleBook.pageCount
            ? ProgressTrackingMode.PAGE
            : ProgressTrackingMode.PERCENT,
          currentPage,
          currentPercent,
        },
      });
    }
  }

  await prisma.activityEvent.create({
    data: {
      guestSessionId: guestSession.id,
      type: 'GUEST_SESSION_CREATED',
      metadata: {
        seeded: true,
        bookCount: books.length,
      },
    },
  });

  console.log(`Seeded ${books.length} sample books and demo guest session ${guestSession.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
