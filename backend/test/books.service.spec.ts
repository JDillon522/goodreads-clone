import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookPersistenceService } from '../src/books/book-persistence.service';
import { BooksService } from '../src/books/books.service';
import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';

describe('BooksService', () => {
  const volume = {
    authors: ['Octavia E. Butler'],
    categories: ['Fiction'],
    description: 'A time-travel novel.',
    ebookAccess: null,
    id: 'google-volume-id',
    infoLink: 'https://books.google.com/books?id=google-volume-id',
    isbn10: '0807083690',
    isbn13: '9780807083697',
    isReadableOnline: false,
    pageCount: 288,
    publishedDate: '1979',
    publisher: 'Beacon Press',
    rawPayload: { id: 'google-volume-id', volumeInfo: {} },
    subtitle: null,
    thumbnailUrl: 'https://books.google.com/cover.jpg',
    title: 'Kindred',
  };
  const cachedBook = {
    createdAt: new Date('2026-07-09T00:00:00.000Z'),
    googleBooksError: null,
    googleBooksRawPayload: volume.rawPayload,
    googleBooksSyncedAt: new Date('2026-07-09T00:00:00.000Z'),
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: 'google-volume-id',
    id: 'book-id',
    isbn10: '0807083690',
    isbn13: '9780807083697',
    normalizedPrimaryAuthor: 'octavia e butler',
    normalizedTitle: 'kindred',
    openLibraryEditionKey: null,
    openLibraryWorkKey: null,
    rawProviderPayload: { google: volume.rawPayload },
    sourceId: 'isbn13:9780807083697',
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: 'https://books.google.com/books?id=google-volume-id',
    updatedAt: new Date('2026-07-09T00:00:00.000Z'),
  };
  const metadataBook = {
    google: volume.rawPayload,
    id: 'book-id',
    openLibrary: {
      coverUrl: null,
      editionKey: null,
      firstPublishDate: null,
      raw: null,
      sourceUrl: null,
      subjects: [],
      workKey: null,
    },
    summary: {
      authors: ['Octavia E. Butler'],
      averageRating: null,
      categories: ['Fiction'],
      coverImages: {
        card: 'https://books.google.com/cover.jpg',
        detail: 'https://books.google.com/cover.jpg',
        theme: 'https://books.google.com/cover.jpg',
        thumbnail: 'https://books.google.com/cover.jpg',
      },
      coverUrl: 'https://books.google.com/cover.jpg',
      dedupeKey: 'isbn13:9780807083697',
      description: 'A time-travel novel.',
      ebookAccess: null,
      externalLinks: {
        buy: null,
        canonical: null,
        info: 'https://books.google.com/books?id=google-volume-id',
        preview: null,
        webReader: null,
      },
      genres: ['Fiction'],
      googleBooksVolumeId: 'google-volume-id',
      isbn10: '0807083690',
      isbn13: '9780807083697',
      isReadableOnline: false,
      language: null,
      pageCount: 288,
      primaryAuthor: 'Octavia E. Butler',
      printType: null,
      providerKey: 'google:google-volume-id',
      publishedDate: '1979',
      publisher: 'Beacon Press',
      ratingsCount: null,
      subtitle: null,
      title: 'Kindred',
    },
    sync: {
      googleBooksError: null,
      googleBooksStatus: GoogleBooksSyncStatus.SYNCED,
      googleBooksSyncedAt: '2026-07-09T00:00:00.000Z',
    },
  };
  const searchVolumes = jest.fn();
  const persistGoogleBooksVolumes = jest.fn();
  const getOrSyncGoogleVolume = jest.fn();
  const toBookMetadata = jest.fn();
  const bookPersistence = {
    getOrSyncGoogleVolume,
    persistGoogleBooksVolumes,
    toBookMetadata,
  } as unknown as BookPersistenceService;
  const googleBooksClient = {
    searchVolumes,
  } as unknown as GoogleBooksClientService;

  let service: BooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(bookPersistence, googleBooksClient);
    searchVolumes.mockResolvedValue({
      items: [volume],
      rawPayload: { items: [volume.rawPayload], totalItems: 1 },
      totalItems: 1,
    });
    persistGoogleBooksVolumes.mockResolvedValue([cachedBook]);
    getOrSyncGoogleVolume.mockResolvedValue(cachedBook);
    toBookMetadata.mockReturnValue(metadataBook);
  });

  it('searches Google Books with native pagination and filters', async () => {
    await expect(
      service.searchBooks({
        filter: 'ebooks',
        limit: 10,
        orderBy: 'newest',
        page: 3,
        printType: 'books',
        query: '  KINDRED  ',
      }),
    ).resolves.toEqual({
      count: 1,
      facets: expect.objectContaining({
        availability: expect.any(Array),
        printTypes: expect.any(Array),
        sortOptions: expect.any(Array),
      }),
      filters: {
        filter: 'ebooks',
        orderBy: 'newest',
        printType: 'books',
      },
      items: [metadataBook],
      limit: 10,
      page: 3,
      query: 'KINDRED',
      total: 1,
    });

    expect(searchVolumes).toHaveBeenCalledWith({
      filter: 'ebooks',
      maxResults: 10,
      orderBy: 'newest',
      printType: 'books',
      query: 'KINDRED',
      startIndex: 20,
    });
    expect(persistGoogleBooksVolumes).toHaveBeenCalledWith([volume]);
  });

  it('defaults Google search controls when omitted', async () => {
    await service.searchBooks({ limit: 5, page: 1, query: 'kindred' });

    expect(searchVolumes).toHaveBeenCalledWith({
      filter: null,
      maxResults: 5,
      orderBy: 'relevance',
      printType: 'books',
      query: 'kindred',
      startIndex: 0,
    });
  });

  it('loads Google detail through the shared cache', async () => {
    await expect(service.getGoogleBookDetail(' google-volume-id ')).resolves.toEqual(metadataBook);

    expect(getOrSyncGoogleVolume).toHaveBeenCalledWith('google-volume-id');
    expect(toBookMetadata).toHaveBeenCalledWith(cachedBook);
  });

  it('rejects blank Google detail ids', async () => {
    await expect(service.getGoogleBookDetail('  ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when Google detail cannot be cached', async () => {
    getOrSyncGoogleVolume.mockResolvedValueOnce(null);

    await expect(service.getGoogleBookDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
