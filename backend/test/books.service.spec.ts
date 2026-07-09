import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BooksService } from '../src/books/books.service';
import { BookSearchResponseDto } from '../src/books/dto/book-search-response.dto';
import { NormalizedBookDto } from '../src/books/dto/normalized-book.dto';
import { OpenLibraryCacheService } from '../src/books/open-library/open-library-cache.service';
import { OpenLibraryClientService } from '../src/books/open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from '../src/books/open-library/open-library-normalizer.service';

describe('BooksService', () => {
  const emptyFilters = {
    format: null,
    subject: null,
    yearFrom: null,
    yearTo: null,
  };
  const emptyFacets = {
    formats: [{ count: 0, label: 'Readable online / eBook', value: 'ebook' }],
    publishedDecades: [],
    subjects: [],
  };
  const normalizedSearch: BookSearchResponseDto = {
    count: 1,
    facets: emptyFacets,
    filters: emptyFilters,
    items: [],
    limit: 10,
    page: 1,
    query: 'kindred',
    total: 1,
  };
  const normalizedBook: NormalizedBookDto = {
    authors: ['Octavia E. Butler'],
    coverUrl: null,
    dedupeKey: 'open-library:works:OL123W',
    description: null,
    genres: [],
    ebookAccess: null,
    isbn10: null,
    isbn13: null,
    isReadableOnline: false,
    openLibraryEditionKey: null,
    openLibraryWorkKey: '/works/OL123W',
    pageCount: null,
    primaryAuthor: 'Octavia E. Butler',
    provider: 'OPEN_LIBRARY',
    providerKey: 'works:OL123W',
    publishedDate: '1979',
    publisher: null,
    sourceId: 'works:OL123W',
    sourceUrl: 'https://openlibrary.org/works/OL123W',
    subtitle: null,
    title: 'Kindred',
  };
  const cacheGetBook = jest.fn();
  const cacheGetSearch = jest.fn();
  const cacheSet = jest.fn().mockResolvedValue(undefined);
  const clientGetDetail = jest.fn();
  const clientSearchBooks = jest.fn();
  const normalizeDetail = jest.fn();
  const normalizeSearch = jest.fn();
  const configGet = jest.fn((key: string) => {
    if (key === 'OPEN_LIBRARY_DETAIL_CACHE_TTL_HOURS') {
      return 168;
    }

    if (key === 'OPEN_LIBRARY_SEARCH_CACHE_TTL_HOURS') {
      return 24;
    }

    return undefined;
  });
  const configService = {
    get: configGet,
  } as unknown as ConfigService;
  const cacheService = {
    getBook: cacheGetBook,
    getSearch: cacheGetSearch,
    set: cacheSet,
  } as unknown as OpenLibraryCacheService;
  const clientService = {
    getDetail: clientGetDetail,
    searchBooks: clientSearchBooks,
  } as unknown as OpenLibraryClientService;
  const normalizerService = {
    normalizeDetail,
    normalizeSearch,
  } as unknown as OpenLibraryNormalizerService;

  let service: BooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BooksService(configService, cacheService, clientService, normalizerService);
  });

  it('returns cached search results without calling Open Library', async () => {
    cacheGetSearch.mockResolvedValueOnce(normalizedSearch);

    await expect(service.searchBooks({ limit: 10, page: 1, query: ' kindred ' })).resolves.toEqual(
      normalizedSearch,
    );
    expect(clientSearchBooks).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('fetches, normalizes, and caches search results on cache miss', async () => {
    const raw = { docs: [], numFound: 1 };
    cacheGetSearch.mockResolvedValueOnce(null);
    clientSearchBooks.mockResolvedValueOnce(raw);
    normalizeSearch.mockReturnValueOnce(normalizedSearch);

    await expect(
      service.searchBooks({ limit: 10, page: 1, query: '  KINDRED  ' }),
    ).resolves.toEqual(normalizedSearch);

    expect(clientSearchBooks).toHaveBeenCalledWith({
      limit: 10,
      page: 1,
      query: 'KINDRED',
    });
    expect(normalizeSearch).toHaveBeenCalledWith(raw, {
      filters: emptyFilters,
      limit: 10,
      page: 1,
      query: 'KINDRED',
    });
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringMatching(/^search:/),
      raw,
      normalizedSearch,
      expect.any(Date),
      'KINDRED',
    );
  });

  it('composes supported filters into the provider query and keeps filters out of the display query', async () => {
    const raw = { docs: [], numFound: 1 };
    const filteredSearch: BookSearchResponseDto = {
      ...normalizedSearch,
      filters: {
        format: 'ebook',
        subject: 'Science fiction',
        yearFrom: 1960,
        yearTo: 1969,
      },
    };
    cacheGetSearch.mockResolvedValueOnce(null);
    clientSearchBooks.mockResolvedValueOnce(raw);
    normalizeSearch.mockReturnValueOnce(filteredSearch);

    await expect(
      service.searchBooks({
        format: 'ebook',
        limit: 10,
        page: 2,
        query: '  le guin  ',
        subject: ' Science   fiction ',
        yearFrom: 1960,
        yearTo: 1969,
      }),
    ).resolves.toEqual(filteredSearch);

    expect(clientSearchBooks).toHaveBeenCalledWith({
      limit: 10,
      page: 2,
      query:
        'le guin first_publish_year:[1960 TO 1969] subject:"Science fiction" has_fulltext:true',
    });
    expect(normalizeSearch).toHaveBeenCalledWith(raw, {
      filters: {
        format: 'ebook',
        subject: 'Science fiction',
        yearFrom: 1960,
        yearTo: 1969,
      },
      limit: 10,
      page: 2,
      query: 'le guin',
    });
  });

  it('includes filters in search cache keys', async () => {
    cacheGetSearch.mockResolvedValue(normalizedSearch);

    await service.searchBooks({ limit: 10, page: 1, query: 'kindred', subject: 'Fiction' });
    await service.searchBooks({
      format: 'ebook',
      limit: 10,
      page: 1,
      query: 'kindred',
      subject: 'Fiction',
    });

    expect(cacheGetSearch.mock.calls[0][0]).not.toBe(cacheGetSearch.mock.calls[1][0]);
  });

  it('rejects inverted year filters', async () => {
    await expect(
      service.searchBooks({ limit: 10, page: 1, query: 'kindred', yearFrom: 2020, yearTo: 1900 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(cacheGetSearch).not.toHaveBeenCalled();
    expect(clientSearchBooks).not.toHaveBeenCalled();
  });

  it('returns cached detail results without calling Open Library', async () => {
    cacheGetBook.mockResolvedValueOnce(normalizedBook);

    await expect(service.getOpenLibraryDetail('works', 'OL123W')).resolves.toEqual(normalizedBook);
    expect(clientGetDetail).not.toHaveBeenCalled();
  });

  it('rejects mismatched Open Library detail type and id pairs', async () => {
    await expect(service.getOpenLibraryDetail('works', 'OL123M')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(cacheGetBook).not.toHaveBeenCalled();
  });
});
