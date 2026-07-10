import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookRelationsService } from '../src/books/book-relations.service';
import { BookPersistenceService } from '../src/books/book-persistence.service';
import { OpenLibraryClientService } from '../src/books/open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from '../src/books/open-library/open-library-normalizer.service';
import { PrismaService } from '../src/database/prisma.service';

const baseBook = {
  authors: ['Ada Author'],
  coverUrl: null,
  createdAt: new Date('2026-07-10T12:00:00.000Z'),
  description: null,
  genres: ['Fantasy'],
  googleBooksError: null,
  googleBooksRawPayload: null,
  googleBooksSyncStatus: GoogleBooksSyncStatus.PENDING,
  googleBooksSyncedAt: null,
  googleBooksVolumeId: null,
  id: '11111111-1111-4111-8111-111111111111',
  isbn10: null,
  isbn13: null,
  normalizedPrimaryAuthor: 'ada author',
  normalizedTitle: 'the test book',
  openLibraryEditionKey: null,
  openLibraryWorkKey: '/works/OL111W',
  pageCount: null,
  primaryAuthor: 'Ada Author',
  publishedDate: '2026',
  publisher: null,
  rawProviderPayload: null,
  seriesEntries: [],
  sourceId: 'works:OL111W',
  sourceProvider: BookProvider.OPEN_LIBRARY,
  sourceUrl: 'https://openlibrary.org/works/OL111W',
  subtitle: null,
  title: 'The Test Book',
  updatedAt: new Date('2026-07-10T12:00:00.000Z'),
};

describe('BookRelationsService', () => {
  const timestamp = new Date('2026-07-10T12:00:00.000Z');
  const sourceBook = book({
    id: '11111111-1111-4111-8111-111111111111',
    normalizedPrimaryAuthor: 'ada author',
    primaryAuthor: 'Ada Author',
    title: 'The Test Book (Test Cycle, #1)',
  });
  const sequelBook = book({
    id: '22222222-2222-4222-8222-222222222222',
    normalizedPrimaryAuthor: 'ada author',
    primaryAuthor: 'Ada Author',
    sourceId: 'works:OL222W',
    title: 'The Sequel (Test Cycle, #2)',
  });
  const series = {
    confidence: 88,
    createdAt: timestamp,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Test Cycle',
    normalizedName: 'test cycle',
    sourceId: sourceBook.sourceId,
    sourceProvider: BookProvider.OPEN_LIBRARY,
    updatedAt: timestamp,
  };
  const prisma = {
    book: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    bookRelation: {
      upsert: jest.fn(),
    },
    bookSeries: {
      upsert: jest.fn(),
    },
    bookSeriesEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const bookPersistence = {
    persistOpenLibraryBooks: jest.fn(),
  } as unknown as BookPersistenceService;
  const openLibraryClient = {
    searchBooks: jest.fn(),
  } as unknown as OpenLibraryClientService;
  const openLibraryNormalizer = {
    normalizeSearch: jest.fn(),
  } as unknown as OpenLibraryNormalizerService;
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
      openLibraryClient,
      openLibraryNormalizer,
      prisma as unknown as PrismaService,
    );
  });

  it('detects and returns a book series from title metadata', async () => {
    prisma.bookSeriesEntry.findMany.mockResolvedValue([
      seriesEntry(sourceBook, 1, 'Book 1'),
      seriesEntry(sequelBook, 2, 'Book 2'),
    ]);

    await expect(service.getSeries(sourceBook.id)).resolves.toEqual({
      bookId: sourceBook.id,
      entries: [
        expect.objectContaining({
          book: expect.objectContaining({ id: sourceBook.id, title: sourceBook.title }),
          position: 1,
          positionLabel: 'Book 1',
        }),
        expect.objectContaining({
          book: expect.objectContaining({ id: sequelBook.id, title: sequelBook.title }),
          position: 2,
          positionLabel: 'Book 2',
        }),
      ],
      seriesName: 'Test Cycle',
    });
    expect(prisma.bookSeries.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: 'test cycle' } }),
    );
    expect(prisma.bookSeriesEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ bookId: sourceBook.id, position: 1 }),
      }),
    );
  });

  it('scores same-author related books without provider seeding when local candidates fill the limit', async () => {
    prisma.book.findMany.mockResolvedValue([sequelBook]);

    await expect(service.getRelatedBooks(sourceBook.id, 1)).resolves.toEqual({
      bookId: sourceBook.id,
      items: [
        expect.objectContaining({
          book: expect.objectContaining({ id: sequelBook.id, title: sequelBook.title }),
          reasons: expect.arrayContaining(['Same author']),
          score: expect.any(Number),
        }),
      ],
    });
    expect(openLibraryClient.searchBooks).not.toHaveBeenCalled();
    expect(prisma.bookRelation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceBookId: sourceBook.id,
          targetBookId: sequelBook.id,
        }),
      }),
    );
  });

  function book(overrides: Partial<typeof baseBook> = {}) {
    return {
      ...baseBook,
      ...overrides,
      createdAt: overrides.createdAt ?? timestamp,
      updatedAt: overrides.updatedAt ?? timestamp,
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
      sourceProvider: BookProvider.OPEN_LIBRARY,
      updatedAt: timestamp,
    };
  }
});
