import { ServiceUnavailableException } from '@nestjs/common';

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

const observation = {
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
};

const matchRequest = {
  detectionId: '77aa72ca-b879-4ea6-8b29-e702f0f10f3b',
  observedAuthors: observation.authors,
  observedIsbn10: observation.isbn10,
  observedIsbn13: observation.isbn13,
  observedPublisher: observation.publisher,
  observedSpineText: observation.spineText,
  observedTitle: observation.title,
};

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

  it('returns visual detections without querying Google Books or the library', () => {
    const result = service.buildAnalysis('gemini-3.5-flash', [observation]);

    expect(result).toEqual(
      expect.objectContaining({
        count: 1,
        detections: [
          expect.objectContaining({
            candidates: [],
            observedTitle: 'The Left Hand of Darkness',
          }),
        ],
        providerIssues: [],
      }),
    );
    expect(searchBooks).not.toHaveBeenCalled();
    expect(listLibraryItems).not.toHaveBeenCalled();
  });

  it('uses visible ISBN in a client-initiated match and returns at most three candidates', async () => {
    searchBooks.mockResolvedValue({
      items: [
        book(),
        book({ googleBooksVolumeId: 'volume-2', id: 'book-2', isbn13: '9780441478996' }),
        book({ googleBooksVolumeId: 'volume-3', id: 'book-3', isbn13: '9780441478774' }),
        book({ googleBooksVolumeId: 'volume-4', id: 'book-4', isbn13: '9780441478668' }),
        book({ googleBooksVolumeId: 'no-isbn', id: 'book-5', isbn10: null, isbn13: null }),
      ],
    });

    const result = await service.match('user-1', matchRequest);

    expect(searchBooks).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'isbn:9780441478125' }),
    );
    expect(result.detectionId).toBe(matchRequest.detectionId);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((candidate) => candidate.classification === 'NEW')).toBe(true);
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

  it('surfaces provider failures from a client-initiated match request', async () => {
    searchBooks.mockRejectedValueOnce(
      new ServiceUnavailableException('Google Books returned an unavailable response.'),
    );

    await expect(
      service.match('user-1', { ...matchRequest, observedIsbn13: null }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not launch Google matches for the other detections in an analysis', () => {
    const result = service.buildAnalysis('gemini-3.5-flash', [
      observation,
      { ...observation, spineText: 'THE DISPOSSESSED', title: 'The Dispossessed' },
      { ...observation, spineText: 'EARTHSEA', title: 'Earthsea' },
    ]);

    expect(result.detections).toHaveLength(3);
    expect(result.detections.every((detection) => detection.candidates.length === 0)).toBe(true);
    expect(searchBooks).not.toHaveBeenCalled();
    expect(listLibraryItems).not.toHaveBeenCalled();
  });
});
