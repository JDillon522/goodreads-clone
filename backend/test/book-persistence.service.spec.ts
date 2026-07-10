import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookPersistenceService } from '../src/books/book-persistence.service';
import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';
import { OpenLibraryClientService } from '../src/books/open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from '../src/books/open-library/open-library-normalizer.service';
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
        imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' },
        industryIdentifiers: [
          { identifier: '0441478123', type: 'ISBN_10' },
          { identifier: '9780441478125', type: 'ISBN_13' },
        ],
        pageCount: 304,
        publishedDate: '1969',
        publisher: 'Ace',
        title: 'The Left Hand of Darkness',
      },
    },
    subtitle: null,
    thumbnailUrl: 'https://books.google.com/cover.jpg',
    title: 'The Left Hand of Darkness',
  };
  const cachedBook = {
    ...bookDefaults(),
    authors: ['Ursula K. Le Guin'],
    coverUrl: 'https://books.google.com/cover.jpg',
    description: 'Google description.',
    genres: ['Science Fiction'],
    googleBooksRawPayload: googleVolume.rawPayload,
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: 'google-volume-id',
    id: 'book-id',
    isbn10: '0441478123',
    isbn13: '9780441478125',
    normalizedPrimaryAuthor: 'ursula k le guin',
    normalizedTitle: 'the left hand of darkness',
    pageCount: 304,
    primaryAuthor: 'Ursula K. Le Guin',
    publishedDate: '1969',
    publisher: 'Ace',
    rawProviderPayload: googleVolume.rawPayload,
    sourceId: 'isbn13:9780441478125',
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: 'https://books.google.com/books?id=google-volume-id',
    title: 'The Left Hand of Darkness',
  };
  const openLibraryBook = {
    authors: ['Ursula K. Le Guin'],
    coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    dedupeKey: 'isbn13:9780441478125',
    description: 'Open Library description.',
    ebookAccess: null,
    genres: ['Fiction', 'Classics'],
    googleBooksVolumeId: null,
    isbn10: '0441478123',
    isbn13: '9780441478125',
    isReadableOnline: false,
    openLibraryEditionKey: '/books/OL1M',
    openLibraryWorkKey: '/works/OL1W',
    pageCount: 300,
    primaryAuthor: 'Ursula K. Le Guin',
    provider: 'OPEN_LIBRARY' as const,
    providerKey: 'works:OL1W',
    publishedDate: '1969',
    publisher: 'Open Library Publisher',
    sourceId: 'works:OL1W',
    sourceUrl: 'https://openlibrary.org/works/OL1W',
    subtitle: null,
    title: 'The Left Hand of Darkness',
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
  const openLibrarySearchBooks = jest.fn();
  const normalizeSearch = jest.fn();
  const prisma = {
    book: {
      create: bookCreate,
      findFirst: bookFindFirst,
      findMany: bookFindMany,
      findUnique: bookFindUnique,
      update: bookUpdate,
      upsert: bookUpsert,
    },
    libraryItem: {
      findMany: libraryItemFindMany,
    },
  } as unknown as PrismaService;
  const googleBooksClient = {
    getVolume,
    searchVolumes,
  } as unknown as GoogleBooksClientService;
  const openLibraryClient = {
    searchBooks: openLibrarySearchBooks,
  } as unknown as OpenLibraryClientService;
  const openLibraryNormalizer = {
    normalizeSearch,
  } as unknown as OpenLibraryNormalizerService;

  let service: BookPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookPersistenceService(
      googleBooksClient,
      openLibraryClient,
      openLibraryNormalizer,
      prisma,
    );
  });

  it('persists Google volumes and fills missing Open Library metadata', async () => {
    bookFindUnique.mockResolvedValueOnce(null);
    bookFindFirst.mockResolvedValueOnce(null);
    bookCreate.mockResolvedValueOnce({ ...cachedBook, openLibraryWorkKey: null });
    openLibrarySearchBooks.mockResolvedValueOnce({ docs: [], numFound: 1 });
    normalizeSearch.mockReturnValueOnce({
      count: 1,
      facets: { availability: [], printTypes: [], sortOptions: [] },
      filters: { filter: null, orderBy: 'relevance', printType: 'books' },
      items: [openLibraryBook],
      limit: 1,
      page: 1,
      query: 'isbn:9780441478125',
      total: 1,
    });
    bookUpdate.mockResolvedValueOnce({
      ...cachedBook,
      openLibraryEditionKey: '/books/OL1M',
      openLibraryWorkKey: '/works/OL1W',
      rawProviderPayload: {
        google: googleVolume.rawPayload,
        openLibrary: openLibraryBook,
      },
    });

    await expect(service.persistGoogleBooksVolumes([googleVolume])).resolves.toEqual([
      expect.objectContaining({
        openLibraryWorkKey: '/works/OL1W',
      }),
    ]);

    expect(bookCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: 'google-volume-id',
        sourceId: 'isbn13:9780441478125',
        sourceProvider: BookProvider.GOOGLE_BOOKS,
      }),
    });
    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        openLibraryEditionKey: '/books/OL1M',
        openLibraryWorkKey: '/works/OL1W',
        rawProviderPayload: expect.objectContaining({ openLibrary: openLibraryBook }),
      }),
      where: { id: 'book-id' },
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
    bookFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    searchVolumes.mockResolvedValueOnce({
      items: [googleVolume],
      rawPayload: { items: [googleVolume.rawPayload], totalItems: 1 },
      totalItems: 1,
    });
    bookFindUnique.mockResolvedValueOnce(null);
    bookCreate.mockResolvedValueOnce(cachedBook);
    openLibrarySearchBooks.mockResolvedValueOnce({ docs: [], numFound: 0 });
    normalizeSearch.mockReturnValueOnce({
      count: 0,
      facets: { availability: [], printTypes: [], sortOptions: [] },
      filters: { filter: null, orderBy: 'relevance', printType: 'books' },
      items: [],
      limit: 1,
      page: 1,
      query: 'isbn:9780441478125',
      total: 0,
    });

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

  it('maps cached books back to raw Google metadata detail DTOs', () => {
    expect(
      service.toBookMetadata({
        ...cachedBook,
        rawProviderPayload: {
          google: googleVolume.rawPayload,
          openLibrary: openLibraryBook,
        },
      }).summary,
    ).toEqual(
      expect.objectContaining({
        coverImages: expect.objectContaining({
          card: 'https://books.google.com/cover.jpg',
          detail: 'https://covers.openlibrary.org/b/id/1-L.jpg',
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
    openLibraryEditionKey: null,
    openLibraryWorkKey: null,
    rawProviderPayload: null,
    updatedAt: new Date('2026-07-09T00:00:00.000Z'),
  };
}
