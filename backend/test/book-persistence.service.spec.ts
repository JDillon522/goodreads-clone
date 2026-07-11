import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookPersistenceService } from '../src/books/book-persistence.service';
import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';
import { PrismaService } from '../src/database/prisma.service';

describe('BookPersistenceService', () => {
  const googleVolume = {
    authors: ['Ursula K. Le Guin'],
    categories: ['Science Fiction'],
    description: 'Google description.',
    ebookAccess: null,
    id: 'google-volume-id',
    infoLink: 'https://books.google.com/books?id=google-volume-id',
    isbn10: '0441478123',
    isbn13: '9780441478125',
    isReadableOnline: false,
    pageCount: 304,
    publishedDate: '1969',
    publisher: 'Ace',
    rawPayload: {
      accessInfo: { viewability: 'NO_PAGES' },
      id: 'google-volume-id',
      volumeInfo: {
        authors: ['Ursula K. Le Guin'],
        categories: ['Science Fiction'],
        description: 'Google description.',
        imageLinks: { thumbnail: 'https://books.google.com/books/content?id=google-volume-id' },
        industryIdentifiers: [
          { identifier: '0441478123', type: 'ISBN_10' },
          { identifier: '9780441478125', type: 'ISBN_13' },
        ],
        infoLink: 'https://books.google.com/books?id=google-volume-id',
        pageCount: 304,
        publishedDate: '1969',
        publisher: 'Ace',
        title: 'The Left Hand of Darkness',
      },
    },
    subtitle: null,
    thumbnailUrl: 'https://books.google.com/books/content?id=google-volume-id',
    title: 'The Left Hand of Darkness',
  };
  const cachedBook = {
    ...bookDefaults(),
    googleBooksRawPayload: googleVolume.rawPayload,
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: 'google-volume-id',
    id: 'book-id',
    isbn10: '0441478123',
    isbn13: '9780441478125',
    normalizedPrimaryAuthor: 'ursula k le guin',
    normalizedTitle: 'the left hand of darkness',
    sourceId: 'isbn13:9780441478125',
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: 'https://books.google.com/books?id=google-volume-id',
  };
  const bookFindUnique = jest.fn();
  const bookFindFirst = jest.fn();
  const bookFindMany = jest.fn();
  const bookCreate = jest.fn();
  const bookUpdate = jest.fn();
  const bookUpsert = jest.fn();
  const libraryItemFindMany = jest.fn();
  const getVolume = jest.fn();
  const searchVolumes = jest.fn();
  const prisma = {
    book: {
      create: bookCreate,
      findFirst: bookFindFirst,
      findMany: bookFindMany,
      findUnique: bookFindUnique,
      update: bookUpdate,
      upsert: bookUpsert,
    },
    libraryItem: { findMany: libraryItemFindMany },
  } as unknown as PrismaService;
  const googleBooksClient = { getVolume, searchVolumes } as unknown as GoogleBooksClientService;

  let service: BookPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookPersistenceService(googleBooksClient, prisma);
  });

  it('persists Google volumes without calling another metadata provider', async () => {
    bookFindUnique.mockResolvedValueOnce(null);
    bookFindFirst.mockResolvedValueOnce(null);
    bookCreate.mockResolvedValueOnce(cachedBook);

    await expect(service.persistGoogleBooksVolumes([googleVolume])).resolves.toEqual([cachedBook]);
    expect(bookCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksRawPayload: googleVolume.rawPayload,
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: 'google-volume-id',
        sourceProvider: BookProvider.GOOGLE_BOOKS,
      }),
    });
  });

  it('returns an existing synced cache row for an ISBN identity', async () => {
    bookFindFirst.mockResolvedValueOnce(cachedBook);

    await expect(service.ensureBookForIdentity({ isbn13: '978-0-441-47812-5' })).resolves.toEqual(
      cachedBook,
    );
    expect(searchVolumes).not.toHaveBeenCalled();
  });

  it('fetches Google metadata when a saved ISBN has no cache row', async () => {
    bookFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    searchVolumes.mockResolvedValueOnce({
      items: [googleVolume],
      rawPayload: { items: [googleVolume.rawPayload], totalItems: 1 },
      totalItems: 1,
    });
    bookFindUnique.mockResolvedValueOnce(null);
    bookCreate.mockResolvedValueOnce(cachedBook);

    await expect(service.ensureBookForIdentity({ isbn13: '9780441478125' })).resolves.toEqual(
      cachedBook,
    );
    expect(searchVolumes).toHaveBeenCalledWith({
      maxResults: 5,
      orderBy: 'relevance',
      printType: 'books',
      query: 'isbn:9780441478125',
      startIndex: 0,
    });
  });

  it('maps cached books using only the raw Google payload', () => {
    const metadata = service.toBookMetadata(cachedBook);

    expect(metadata).not.toHaveProperty('openLibrary');
    expect(metadata.summary).toEqual(
      expect.objectContaining({
        coverImages: expect.objectContaining({
          card: 'https://books.google.com/books/content?id=google-volume-id',
          detail: 'https://books.google.com/books/content?id=google-volume-id',
        }),
        dedupeKey: 'isbn13:9780441478125',
        googleBooksVolumeId: 'google-volume-id',
        providerKey: 'google:google-volume-id',
        title: 'The Left Hand of Darkness',
      }),
    );
  });
});

function bookDefaults() {
  return {
    createdAt: new Date('2026-07-09T00:00:00.000Z'),
    googleBooksError: null,
    googleBooksRawPayload: null,
    googleBooksSyncedAt: null,
    googleBooksVolumeId: null,
    isbn10: null,
    isbn13: null,
    rawProviderPayload: null,
    updatedAt: new Date('2026-07-09T00:00:00.000Z'),
  };
}
