const { PrismaPg } = require('@prisma/adapter-pg');
const {
  PrismaClient,
  BookProvider,
  GoogleBooksSyncStatus,
  LibraryItemStatus,
  ProgressTrackingMode,
  ThemePreference,
  UserRole,
} = require('@prisma/client');
const argon2 = require('argon2');
const dotenv = require('dotenv');
const fs = require('node:fs');
const path = require('node:path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl =
  process.env.DATABASE_URL ??
  databaseUrlFromParts({
    database: process.env.POSTGRES_DB,
    schema: process.env.POSTGRES_SCHEMA,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_HOST_PORT,
  });
const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

function databaseUrlFromParts({
  database,
  schema = 'public',
  user,
  password,
  host = 'localhost',
  port = '5432',
}) {
  if (!database || !user || !password) {
    throw new Error(
      'DATABASE_URL or POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD must be set in .env.',
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?schema=${encodeURIComponent(schema)}`;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set in the root .env file.`);
  }

  return value;
}

const standardShelves = [
  { name: 'Unshelved', slug: 'unshelved', position: 0, isDefault: true },
  { name: 'Want to Read', slug: 'want-to-read', position: 1, isDefault: true },
  { name: 'Currently Reading', slug: 'currently-reading', position: 2, isDefault: true },
  { name: 'Read', slug: 'read', position: 3, isDefault: true },
];
const defaultShelves = [
  ...standardShelves,
  { name: 'Favorites', slug: 'favorites', position: 4, isDefault: false },
  { name: 'Book Club', slug: 'book-club', position: 5, isDefault: false },
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

function cleanIsbn(value) {
  return typeof value === 'string' ? value.replace(/[-\s]/g, '').toUpperCase() || null : null;
}

function readGoogleBooksSnapshot() {
  const snapshotPath = path.resolve(__dirname, '../../data/google-books-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  if (snapshot.provider !== 'GOOGLE_BOOKS' || !Array.isArray(snapshot.volumes)) {
    throw new Error('data/google-books-snapshot.json is not a valid Google Books snapshot.');
  }

  return snapshot;
}

async function prewarmGoogleBooksCache(books, snapshot) {
  const snapshotsByIsbn = new Map();
  const snapshotsByTitle = new Map();

  for (const entry of snapshot.volumes) {
    if (typeof entry.title === 'string') {
      snapshotsByTitle.set(normalizeText(entry.title), entry);
    }

    for (const isbn of [cleanIsbn(entry.isbn13), cleanIsbn(entry.isbn10)]) {
      if (isbn) {
        snapshotsByIsbn.set(isbn, entry);
      }
    }
  }

  for (const sampleBook of books) {
    const identity = cleanIsbn(sampleBook.isbn13) ?? cleanIsbn(sampleBook.isbn10);
    const entry =
      (identity ? snapshotsByIsbn.get(identity) : null) ??
      snapshotsByTitle.get(normalizeText(sampleBook.title));
    const volume = entry?.volume;
    const volumeInfo = volume?.volumeInfo;

    if (!entry || !volume || typeof volume.id !== 'string' || !volumeInfo) {
      throw new Error(`Google Books snapshot is missing ${sampleBook.title}.`);
    }

    const authors = Array.isArray(volumeInfo.authors) ? volumeInfo.authors : [];
    const sourceId = sourceIdForBook(sampleBook);
    const sourceUrl =
      typeof volumeInfo.infoLink === 'string'
        ? volumeInfo.infoLink.replace(/^http:\/\//i, 'https://')
        : null;

    await prisma.book.upsert({
      where: {
        sourceProvider_sourceId: {
          sourceProvider: BookProvider.GOOGLE_BOOKS,
          sourceId,
        },
      },
      create: {
        sourceProvider: BookProvider.GOOGLE_BOOKS,
        sourceId,
        sourceUrl,
        isbn10: cleanIsbn(entry.isbn10),
        isbn13: cleanIsbn(entry.isbn13),
        googleBooksVolumeId: volume.id,
        googleBooksSyncedAt: new Date(snapshot.generatedAt),
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksRawPayload: volume,
        normalizedTitle: normalizeText(volumeInfo.title ?? sampleBook.title),
        normalizedPrimaryAuthor: authors[0] ? normalizeText(authors[0]) : null,
      },
      update: {
        sourceUrl,
        isbn10: cleanIsbn(entry.isbn10),
        isbn13: cleanIsbn(entry.isbn13),
        googleBooksVolumeId: volume.id,
        googleBooksSyncedAt: new Date(snapshot.generatedAt),
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksRawPayload: volume,
        googleBooksError: null,
        normalizedTitle: normalizeText(volumeInfo.title ?? sampleBook.title),
        normalizedPrimaryAuthor: authors[0] ? normalizeText(authors[0]) : null,
      },
    });
  }
}

async function main() {
  const sampleBooksPath = path.resolve(__dirname, '../../data/sample-books.json');
  const books = JSON.parse(fs.readFileSync(sampleBooksPath, 'utf8'));
  const googleBooksSnapshot = readGoogleBooksSnapshot();
  const year = new Date().getUTCFullYear();
  const adminEmail = requiredEnv('ADMIN_EMAIL');
  const adminUsername = requiredEnv('ADMIN_USERNAME');
  const adminPasswordHash = await argon2.hash(requiredEnv('ADMIN_PASSWORD'), {
    type: argon2.argon2id,
  });
  const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || 'Bookshelf Admin';

  await prewarmGoogleBooksCache(books, googleBooksSnapshot);

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    create: {
      email: adminEmail,
      username: adminUsername,
      displayName: adminDisplayName,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
    update: {
      deactivatedAt: null,
      displayName: adminDisplayName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  const adminShelves = {};

  for (const shelf of standardShelves) {
    adminShelves[shelf.slug] = await prisma.shelf.upsert({
      where: {
        userId_slug: {
          userId: adminUser.id,
          slug: shelf.slug,
        },
      },
      create: {
        userId: adminUser.id,
        ...shelf,
      },
      update: {
        ...shelf,
        deactivatedAt: null,
      },
    });
  }

  await prisma.userPreference.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      theme: ThemePreference.SYSTEM,
      defaultShelfId: adminShelves.unshelved.id,
    },
    update: {
      theme: ThemePreference.SYSTEM,
      defaultShelfId: adminShelves.unshelved.id,
    },
  });

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
      defaultShelfId: shelves.unshelved.id,
    },
    update: {
      theme: ThemePreference.SYSTEM,
      defaultShelfId: shelves.unshelved.id,
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
    if (!sampleBook.isbn13 && !sampleBook.isbn10) {
      continue;
    }

    const shelfSlug = shelfSlugForIndex(index);
    const shelf = shelves[shelfSlug];
    const isRead = shelfSlug === 'read' || shelfSlug === 'favorites';
    const isCurrentlyReading = shelfSlug === 'currently-reading';

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
        dedupeKey: dedupeKeyForBook(sampleBook),
        isbn10: sampleBook.isbn10 ?? null,
        isbn13: sampleBook.isbn13 ?? null,
        rating: isRead ? 3 + (index % 3) : null,
        notes: isRead ? `Seed note for ${sampleBook.title}.` : null,
        currentPage,
        currentPercent,
        progressUpdatedAt: currentPercent !== null ? dateDaysAgo(index + 1) : null,
        dateAdded: dateDaysAgo(90 - index),
        dateFinished: isRead ? dateDaysAgo(60 - index) : null,
        status: isRead
          ? LibraryItemStatus.READ
          : isCurrentlyReading
            ? LibraryItemStatus.READING
            : LibraryItemStatus.WANT_TO_READ,
        shelves: {
          create: {
            shelfId: shelf.id,
          },
        },
      },
      update: {
        isbn10: sampleBook.isbn10 ?? null,
        isbn13: sampleBook.isbn13 ?? null,
        rating: isRead ? 3 + (index % 3) : null,
        notes: isRead ? `Seed note for ${sampleBook.title}.` : null,
        currentPage,
        currentPercent,
        progressUpdatedAt: currentPercent !== null ? dateDaysAgo(index + 1) : null,
        dateFinished: isRead ? dateDaysAgo(60 - index) : null,
        status: isRead
          ? LibraryItemStatus.READ
          : isCurrentlyReading
            ? LibraryItemStatus.READING
            : LibraryItemStatus.WANT_TO_READ,
      },
    });

    await prisma.libraryItemShelf.upsert({
      where: {
        libraryItemId_shelfId: {
          libraryItemId: libraryItem.id,
          shelfId: shelf.id,
        },
      },
      create: {
        libraryItemId: libraryItem.id,
        shelfId: shelf.id,
      },
      update: {},
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

  console.log(
    `Seeded admin user, ${books.length} sample books, and demo guest session ${guestSession.id}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
