import { BookProvider, GoogleBooksSyncStatus } from '@prisma/client';

import { BookPersistenceService } from '../src/books/book-persistence.service';
import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';
import { NormalizedBookDto } from '../src/books/dto/normalized-book.dto';
import { PrismaService } from '../src/database/prisma.service';

describe('BookPersistenceService', () => {
  const normalizedBook: NormalizedBookDto = {
    authors: ['Ursula K. Le Guin'],
    coverUrl: null,
    dedupeKey: 'isbn13:9780441478125',
    description: null,
    ebookAccess: null,
    genres: ['Science fiction'],
    isbn10: '0441478123',
    isbn13: '9780441478125',
    isReadableOnline: false,
    openLibraryEditionKey: '/books/OL24631830M',
    openLibraryWorkKey: '/works/OL262758W',
    pageCount: null,
    primaryAuthor: 'Ursula K. Le Guin',
    provider: 'OPEN_LIBRARY',
    providerKey: 'works:OL262758W',
    publishedDate: '1969',
    publisher: null,
    sourceId: 'works:OL262758W',
    sourceUrl: 'https://openlibrary.org/works/OL262758W',
    subtitle: null,
    title: 'The Left Hand of Darkness',
  };
  const createdBook = {
    ...bookDefaults(),
    authors: ['Ursula K. Le Guin'],
    genres: ['Science fiction'],
    googleBooksSyncStatus: GoogleBooksSyncStatus.PENDING,
    id: 'book-id',
    isbn10: '0441478123',
    isbn13: '9780441478125',
    normalizedPrimaryAuthor: 'ursula k le guin',
    normalizedTitle: 'the left hand of darkness',
    openLibraryEditionKey: '/books/OL24631830M',
    openLibraryWorkKey: '/works/OL262758W',
    primaryAuthor: 'Ursula K. Le Guin',
    publishedDate: '1969',
    sourceId: 'works:OL262758W',
    sourceProvider: BookProvider.OPEN_LIBRARY,
    sourceUrl: 'https://openlibrary.org/works/OL262758W',
    title: 'The Left Hand of Darkness',
  };
  const bookFindUnique = jest.fn();
  const bookFindMany = jest.fn();
  const bookCreate = jest.fn();
  const bookUpdate = jest.fn();
  const findBestVolume = jest.fn();
  const prisma = {
    book: {
      create: bookCreate,
      findMany: bookFindMany,
      findUnique: bookFindUnique,
      update: bookUpdate,
    },
  } as unknown as PrismaService;
  const googleBooksClient = {
    findBestVolume,
  } as unknown as GoogleBooksClientService;

  let service: BookPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookPersistenceService(googleBooksClient, prisma);
  });

  it('persists Open Library search books and merges Google Books metadata into missing fields', async () => {
    bookFindUnique.mockResolvedValueOnce(null);
    bookCreate.mockResolvedValueOnce(createdBook);
    findBestVolume.mockResolvedValueOnce({
      authors: ['Ursula K. Le Guin'],
      categories: ['Fiction'],
      description: 'A novel of winter and politics.',
      id: 'google-volume-id',
      isbn10: '0441478123',
      isbn13: '9780441478125',
      pageCount: 304,
      publishedDate: '1969-03',
      publisher: 'Ace',
      rawPayload: { id: 'google-volume-id', volumeInfo: {} },
      thumbnailUrl: 'https://books.google.com/cover.jpg',
      title: 'The Left Hand of Darkness',
    });
    bookUpdate.mockResolvedValueOnce({ ...createdBook, googleBooksSyncStatus: 'SYNCED' });

    await service.persistOpenLibraryBooks([normalizedBook]);

    expect(bookCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksSyncStatus: GoogleBooksSyncStatus.PENDING,
        sourceId: 'works:OL262758W',
        sourceProvider: BookProvider.OPEN_LIBRARY,
      }),
    });
    expect(findBestVolume).toHaveBeenCalledWith({
      isbn10: '0441478123',
      isbn13: '9780441478125',
      primaryAuthor: 'Ursula K. Le Guin',
      title: 'The Left Hand of Darkness',
    });
    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'A novel of winter and politics.',
        genres: ['Science fiction', 'Fiction'],
        googleBooksError: null,
        googleBooksRawPayload: { id: 'google-volume-id', volumeInfo: {} },
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: 'google-volume-id',
        pageCount: 304,
        publisher: 'Ace',
      }),
      where: { id: 'book-id' },
    });
  });

  it('preserves richer existing fields when saving another provider result', async () => {
    bookFindUnique.mockResolvedValueOnce({
      ...createdBook,
      coverUrl: 'https://existing.example/cover.jpg',
      description: 'Already curated.',
      genres: ['Classic'],
      googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
      pageCount: 304,
      publisher: 'Existing publisher',
    });
    bookUpdate.mockResolvedValueOnce(createdBook);

    await service.upsertOpenLibraryBook(prisma, normalizedBook);

    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coverUrl: 'https://existing.example/cover.jpg',
        description: 'Already curated.',
        genres: ['Classic', 'Science fiction'],
        pageCount: 304,
        publisher: 'Existing publisher',
      }),
      where: { id: 'book-id' },
    });
  });

  it('syncs pending and failed books during the startup sweep', async () => {
    const pending = {
      ...createdBook,
      googleBooksSyncStatus: GoogleBooksSyncStatus.PENDING,
      id: 'pending-book-id',
    };
    const failed = {
      ...createdBook,
      googleBooksSyncStatus: GoogleBooksSyncStatus.FAILED,
      googleBooksSyncedAt: new Date('2026-07-09T00:00:00.000Z'),
      id: 'failed-book-id',
    };
    bookFindMany.mockResolvedValueOnce([pending, failed]);
    findBestVolume.mockResolvedValue({
      authors: ['Ursula K. Le Guin'],
      categories: ['Fiction'],
      description: 'A novel of winter and politics.',
      id: 'google-volume-id',
      isbn10: '0441478123',
      isbn13: '9780441478125',
      pageCount: 304,
      publishedDate: '1969-03',
      publisher: 'Ace',
      rawPayload: { id: 'google-volume-id', volumeInfo: {} },
      thumbnailUrl: 'https://books.google.com/cover.jpg',
      title: 'The Left Hand of Darkness',
    });
    bookUpdate.mockResolvedValue(createdBook);

    await expect(service.syncPendingGoogleBooks()).resolves.toBe(2);

    expect(bookFindMany).toHaveBeenCalledWith({
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      where: {
        googleBooksSyncStatus: {
          in: [GoogleBooksSyncStatus.PENDING, GoogleBooksSyncStatus.FAILED],
        },
      },
    });
    expect(findBestVolume).toHaveBeenCalledTimes(2);
    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: 'google-volume-id',
      }),
      where: { id: 'pending-book-id' },
    });
    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
        googleBooksVolumeId: 'google-volume-id',
      }),
      where: { id: 'failed-book-id' },
    });
  });

  it('syncs one persisted book by id when a user opens or adds it', async () => {
    bookFindUnique.mockResolvedValueOnce(createdBook);
    findBestVolume.mockResolvedValueOnce(null);
    bookUpdate.mockResolvedValueOnce(createdBook);

    await service.syncGoogleBooksForBookId('book-id');

    expect(bookFindUnique).toHaveBeenCalledWith({
      where: { id: 'book-id' },
    });
    expect(bookUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        googleBooksError: null,
        googleBooksSyncStatus: GoogleBooksSyncStatus.NOT_FOUND,
      }),
      where: { id: 'book-id' },
    });
  });
});

function bookDefaults() {
  return {
    coverUrl: null,
    createdAt: new Date('2026-07-09T00:00:00.000Z'),
    description: null,
    googleBooksError: null,
    googleBooksRawPayload: null,
    googleBooksSyncedAt: null,
    googleBooksVolumeId: null,
    isbn10: null,
    isbn13: null,
    pageCount: null,
    publisher: null,
    rawProviderPayload: null,
    subtitle: null,
    updatedAt: new Date('2026-07-09T00:00:00.000Z'),
  };
}
