import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookRelationsService } from '../src/books/book-relations.service';
import { BookPersistenceService } from '../src/books/book-persistence.service';
import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';
import { PrismaService } from '../src/database/prisma.service';

const timestamp = new Date('2026-07-10T12:00:00.000Z');
const baseBook = {
  createdAt: timestamp,
  googleBooksError: null,
  googleBooksRawPayload: googlePayload('The Test Book', 'Ada Author'),
  googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
  googleBooksSyncedAt: timestamp,
  googleBooksVolumeId: 'google-source',
  id: '11111111-1111-4111-8111-111111111111',
  isbn10: null,
  isbn13: '9780000000001',
  normalizedPrimaryAuthor: 'ada author',
  normalizedTitle: 'the test book',
  rawProviderPayload: null,
  seriesEntries: [],
  sourceId: 'isbn13:9780000000001',
  sourceProvider: BookProvider.GOOGLE_BOOKS,
  sourceUrl: 'https://books.google.com/books?id=google-source',
  updatedAt: timestamp,
};

describe('BookRelationsService', () => {
  const sourceBook = book({
    googleBooksRawPayload: googlePayload('The Test Book (Test Cycle, #1)', 'Ada Author'),
    normalizedTitle: 'the test book test cycle 1',
  });
  const sequelBook = book({
    googleBooksRawPayload: googlePayload('The Sequel (Test Cycle, #2)', 'Ada Author'),
    googleBooksVolumeId: 'google-sequel',
    id: '22222222-2222-4222-8222-222222222222',
    isbn13: '9780000000002',
    normalizedTitle: 'the sequel test cycle 2',
    sourceId: 'isbn13:9780000000002',
  });
  const series = {
    confidence: 88,
    createdAt: timestamp,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Test Cycle',
    normalizedName: 'test cycle',
    sourceId: sourceBook.sourceId,
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    updatedAt: timestamp,
  };
  const prisma = {
    book: { findMany: jest.fn(), findUnique: jest.fn() },
    bookRelation: { upsert: jest.fn() },
    bookSeries: { upsert: jest.fn() },
    bookSeriesEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const persistGoogleBooksVolumes = jest.fn();
  const bookPersistence = { persistGoogleBooksVolumes } as unknown as BookPersistenceService;
  const searchVolumes = jest.fn();
  const googleBooksClient = { searchVolumes } as unknown as GoogleBooksClientService;
  let service: BookRelationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.book.findUnique.mockResolvedValue(sourceBook);
    prisma.bookSeries.upsert.mockResolvedValue(series);
    prisma.bookSeriesEntry.findFirst.mockResolvedValue(null);
    prisma.bookSeriesEntry.upsert.mockResolvedValue({});
    prisma.bookRelation.upsert.mockResolvedValue({});
    service = new BookRelationsService(
      bookPersistence,
      googleBooksClient,
      prisma as unknown as PrismaService,
    );
  });

  it('detects and returns a book series from Google-backed title metadata', async () => {
    prisma.bookSeriesEntry.findMany.mockResolvedValue([
      seriesEntry(sourceBook, 1, 'Book 1'),
      seriesEntry(sequelBook, 2, 'Book 2'),
    ]);

    await expect(service.getSeries(sourceBook.id)).resolves.toEqual({
      bookId: sourceBook.id,
      entries: [
        expect.objectContaining({ position: 1, positionLabel: 'Book 1' }),
        expect.objectContaining({ position: 2, positionLabel: 'Book 2' }),
      ],
      seriesName: 'Test Cycle',
    });
    expect(prisma.bookSeries.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: 'test cycle' } }),
    );
  });

  it('scores local Google books without provider seeding when candidates fill the limit', async () => {
    prisma.book.findMany.mockResolvedValue([sequelBook]);

    await expect(service.getRelatedBooks(sourceBook.id, 1)).resolves.toEqual({
      bookId: sourceBook.id,
      items: [
        expect.objectContaining({
          reasons: expect.arrayContaining(['Same author']),
          score: expect.any(Number),
        }),
      ],
    });
    expect(searchVolumes).not.toHaveBeenCalled();
  });

  it('seeds missing related candidates through Google Books queries', async () => {
    prisma.book.findMany.mockResolvedValue([]);
    searchVolumes.mockResolvedValue({
      items: [
        {
          authors: ['Ada Author'],
          categories: ['Fantasy'],
          description: null,
          ebookAccess: null,
          id: 'google-candidate',
          infoLink: null,
          isbn10: null,
          isbn13: '9780000000003',
          isReadableOnline: false,
          pageCount: null,
          publishedDate: '2025',
          publisher: null,
          rawPayload: googlePayload('Another Test Book', 'Ada Author'),
          subtitle: null,
          thumbnailUrl: null,
          title: 'Another Test Book',
        },
      ],
      rawPayload: {},
      totalItems: 1,
    });
    persistGoogleBooksVolumes.mockResolvedValue([]);

    await expect(service.getRelatedBooks(sourceBook.id, 2)).resolves.toEqual({
      bookId: sourceBook.id,
      items: [],
    });
    expect(searchVolumes).toHaveBeenCalledWith(
      expect.objectContaining({
        maxResults: 6,
        orderBy: 'relevance',
        printType: 'books',
        startIndex: 0,
      }),
    );
    expect(persistGoogleBooksVolumes).toHaveBeenCalled();
  });

  function book(overrides: Partial<typeof baseBook> = {}) {
    return {
      ...baseBook,
      ...overrides,
      createdAt: timestamp,
      seriesEntries: [],
      updatedAt: timestamp,
    };
  }

  function seriesEntry(
    targetBook: ReturnType<typeof book>,
    position: number,
    positionLabel: string,
  ) {
    return {
      book: targetBook,
      bookId: targetBook.id,
      confidence: 88,
      createdAt: timestamp,
      id: `${targetBook.id}-entry`,
      position,
      positionLabel,
      seriesId: series.id,
      sourceProvider: BookProvider.GOOGLE_BOOKS,
      updatedAt: timestamp,
    };
  }
});

function googlePayload(title: string, author: string) {
  return {
    id: `google-${title}`,
    volumeInfo: {
      authors: [author],
      categories: ['Fantasy'],
      publishedDate: '2026',
      title,
    },
  };
}
