import { BooksService } from '../src/books/books.service';
import { BookshelfCandidateService } from '../src/bookshelves/bookshelf-candidate.service';
import { LibraryService } from '../src/library/library.service';

const summary = (overrides: Record<string, unknown> = {}) => ({
  authors: ['Ursula K. Le Guin'],
  averageRating: null,
  categories: ['Fiction'],
  coverImages: { card: null, detail: null, theme: null, thumbnail: null },
  coverUrl: null,
  dedupeKey: 'isbn13:9780441478125',
  description: null,
  ebookAccess: null,
  externalLinks: { buy: null, canonical: null, info: null, preview: null, webReader: null },
  genres: ['Fiction'],
  googleBooksVolumeId: 'volume-1',
  isbn10: '0441478123',
  isbn13: '9780441478125',
  isReadableOnline: false,
  language: 'en',
  pageCount: 304,
  primaryAuthor: 'Ursula K. Le Guin',
  printType: 'BOOK',
  providerKey: 'google:volume-1',
  publishedDate: '1969',
  publisher: 'Ace Books',
  ratingsCount: null,
  subtitle: null,
  title: 'The Left Hand of Darkness',
  ...overrides,
});

const book = (overrides: Record<string, unknown> = {}) => ({
  google: null,
  id: stringOverride(overrides['id'], 'book-1'),
  summary: summary(overrides),
  sync: { googleBooksError: null, googleBooksStatus: 'SYNCED', googleBooksSyncedAt: null },
});

const libraryItem = (overrides: Record<string, unknown> = {}) => ({
  book: book(overrides),
  createdAt: '2026-07-12T00:00:00.000Z',
  currentPage: null,
  currentPercent: null,
  dateAdded: '2026-07-12T00:00:00.000Z',
  dateFinished: null,
  dedupeKey: stringOverride(overrides['dedupeKey'], 'isbn13:9780441478125'),
  id: stringOverride(overrides['itemId'], 'item-1'),
  notes: null,
  progressUpdatedAt: null,
  rating: null,
  shelves: [],
  status: 'WANT_TO_READ',
  updatedAt: '2026-07-12T00:00:00.000Z',
});

function stringOverride(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

describe('BookshelfCandidateService', () => {
  const searchBooks = jest.fn();
  const listLibraryItems = jest.fn();
  const service = new BookshelfCandidateService(
    { searchBooks } as unknown as BooksService,
    { listLibraryItems } as unknown as LibraryService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    searchBooks.mockResolvedValue({ items: [book()] });
    listLibraryItems.mockResolvedValue([]);
  });

  it('uses visible ISBN first and returns no more than three savable candidates', async () => {
    searchBooks.mockResolvedValue({
      items: [
        book(),
        book({ googleBooksVolumeId: 'volume-2', id: 'book-2', isbn13: '9780441478996' }),
        book({ googleBooksVolumeId: 'volume-3', id: 'book-3', isbn13: '9780441478774' }),
        book({ googleBooksVolumeId: 'volume-4', id: 'book-4', isbn13: '9780441478668' }),
        book({ googleBooksVolumeId: 'no-isbn', id: 'book-5', isbn10: null, isbn13: null }),
      ],
    });

    const result = await service.buildAnalysis('user-1', 'gemini-3.5-flash', [
      {
        authors: ['Ursula K. Le Guin'],
        confidence: 90,
        height: 800,
        isbn10: null,
        isbn13: '9780441478125',
        publisher: null,
        rotationDegrees: 0,
        spineText: 'THE LEFT HAND OF DARKNESS',
        title: 'The Left Hand of Darkness',
        width: 80,
        x: 100,
        y: 50,
      },
    ]);

    expect(searchBooks).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'isbn:9780441478125' }),
    );
    expect(result.detections[0].candidates).toHaveLength(3);
    expect(
      result.detections[0].candidates.every((candidate) => candidate.classification === 'NEW'),
    ).toBe(true);
  });

  it('distinguishes exact ISBN ownership from a different edition of the same work', async () => {
    listLibraryItems.mockResolvedValue([libraryItem()]);

    await expect(service.search('user-1', 'left hand darkness')).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ classification: 'EXACT_EDITION' })],
      }),
    );

    searchBooks.mockResolvedValue({
      items: [
        book({
          dedupeKey: 'isbn13:9780441478996',
          googleBooksVolumeId: 'volume-other',
          isbn10: null,
          isbn13: '9780441478996',
        }),
      ],
    });

    await expect(service.search('user-1', 'left hand darkness')).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ classification: 'DIFFERENT_EDITION' })],
      }),
    );
  });
});
