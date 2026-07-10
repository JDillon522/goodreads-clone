import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type { BookSearchResponse, NormalizedBook, ShelfResponse } from '../../core/api/api.types';
import { Books } from '../../core/books/books';
import type { BookSearchRequestFilters } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { Search } from './search';

const timestamp = '2026-07-08T12:00:00.000Z';

const unshelved: ShelfResponse = {
  createdAt: timestamp,
  deactivatedAt: null,
  id: 'unshelved',
  isDefault: true,
  itemCount: 0,
  name: 'Unshelved',
  position: 0,
  slug: 'unshelved',
  updatedAt: timestamp,
};

function normalizedBook(query: string, page: number): NormalizedBook {
  const volumeId = `google-${query}-${page}`;

  return {
    google: {
      id: volumeId,
      volumeInfo: {
        authors: [query],
        categories: ['Fantasy'],
        industryIdentifiers: [{ identifier: '9780441478125', type: 'ISBN_13' }],
        title: `${query} Book ${page}`,
      },
    },
    id: `book-${volumeId}`,
    openLibrary: {
      coverUrl: null,
      editionKey: null,
      firstPublishDate: null,
      raw: null,
      sourceUrl: null,
      subjects: ['Fantasy'],
      workKey: null,
    },
    summary: {
      authors: [query],
      averageRating: null,
      categories: ['Fantasy'],
      coverImages: {
        card: null,
        detail: null,
        theme: null,
        thumbnail: null,
      },
      coverUrl: null,
      dedupeKey: `isbn13:9780441478125`,
      description: null,
      ebookAccess: page === 1 ? 'public' : null,
      externalLinks: {
        buy: null,
        canonical: null,
        info: null,
        preview: null,
        webReader: null,
      },
      genres: ['Fantasy'],
      googleBooksVolumeId: volumeId,
      isbn10: null,
      isbn13: '9780441478125',
      isReadableOnline: page === 1,
      language: null,
      pageCount: 304,
      primaryAuthor: query,
      printType: 'BOOK',
      providerKey: `google:${volumeId}`,
      publishedDate: '1969',
      publisher: 'Ace Books',
      ratingsCount: null,
      subtitle: null,
      title: `${query} Book ${page}`,
    },
    sync: {
      googleBooksError: null,
      googleBooksStatus: 'SYNCED',
      googleBooksSyncedAt: null,
    },
  };
}

function searchResponse(
  query: string,
  page: number,
  filters: BookSearchRequestFilters = {},
): BookSearchResponse {
  return {
    count: 1,
    facets: {
      availability: [
        { count: 1, label: 'All availability', value: 'all' },
        { count: 1, label: 'eBooks', value: 'ebooks' },
      ],
      printTypes: [{ count: 1, label: 'Books', value: 'books' }],
      sortOptions: [
        { count: 1, label: 'Relevance', value: 'relevance' },
        { count: 1, label: 'Newest', value: 'newest' },
      ],
    },
    filters: {
      filter: filters.filter ?? null,
      orderBy: filters.orderBy ?? 'relevance',
      printType: filters.printType ?? 'books',
    },
    items: [normalizedBook(query, page)],
    limit: 10,
    page,
    query,
    total: 21,
  };
}

function waitForAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

class MockBooks {
  public readonly search = vi.fn(
    async (query: string, page: number, _limit: number, filters: BookSearchRequestFilters = {}) =>
      searchResponse(query, page, filters),
  );
}

class MockLibrary {
  public readonly add = vi.fn(async () => ({ id: 'library-item-1' }));
}

class MockRouter {
  public readonly navigate = vi.fn(async () => true);
}

class MockShelves {
  private readonly revision = signal(0);
  public readonly version = this.revision.asReadonly();
  public readonly list = vi.fn(async () => [unshelved]);
}

describe('Search', () => {
  let books: MockBooks;
  let library: MockLibrary;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: MockRouter;

  beforeEach(async () => {
    books = new MockBooks();
    library = new MockLibrary();
    router = new MockRouter();
    queryParamMap = new BehaviorSubject(convertToParamMap({ query: 'Ada Author' }));

    await TestBed.configureTestingModule({
      imports: [Search],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: Books, useValue: books },
        { provide: LibraryService, useValue: library },
        { provide: Router, useValue: router },
        { provide: Shelves, useClass: MockShelves },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('prefills and runs search from the query string', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(books.search).toHaveBeenCalledWith('Ada Author', 1, 10, {});
    expect(element.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe(
      'Ada Author',
    );
    expect(element.textContent).toContain('Ada Author Book');
    expect(element.textContent).toContain('1969 | Ace Books | 304 pages | 9780441478125');
    expect(element.textContent).toContain('View details');
    expect(element.textContent).toContain('Filters');
    expect(element.textContent).toContain('eBooks');
    expect(element.textContent).toContain('Books');
    expect(element.textContent).toContain('Newest');
    expect(element.textContent).toContain('Page 1 of 3');
  });

  it('opens clicked search results on the info-only detail page', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.result-card__detail')!
      .click();
    await fixture.whenStable();

    expect(library.add).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenLastCalledWith([
      '/app/book-info/google',
      'google-Ada Author-1',
    ]);
  });

  it('runs a new search when the query string changes', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();

    queryParamMap.next(
      convertToParamMap({
        filter: 'ebooks',
        orderBy: 'newest',
        page: '2',
        printType: 'books',
        query: 'Octavia Butler',
      }),
    );
    await waitForAsyncWork();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(books.search).toHaveBeenLastCalledWith('Octavia Butler', 2, 10, {
      filter: 'ebooks',
      orderBy: 'newest',
      printType: 'books',
    });
    expect(fixture.nativeElement.textContent).toContain('Octavia Butler Book 2');
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 3');
  });

  it('updates the page query param from the pagination controls', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          filter: null,
          format: null,
          orderBy: null,
          page: 2,
          printType: null,
          query: 'Ada Author',
          subject: null,
          yearFrom: null,
          yearTo: null,
        },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('resets pagination and updates filter query params from facet chips', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const ebookButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.facet-chip'),
    ).find((button) => button.textContent?.includes('eBooks'))!;

    ebookButton.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          filter: 'ebooks',
          format: null,
          orderBy: null,
          page: null,
          printType: null,
          query: 'Ada Author',
          subject: null,
          yearFrom: null,
          yearTo: null,
        },
      }),
    );
  });

  it('preserves active filters while paginating and can clear them', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();

    queryParamMap.next(
      convertToParamMap({
        filter: 'ebooks',
        orderBy: 'newest',
        page: '2',
        query: 'Ada Author',
      }),
    );
    await waitForAsyncWork();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          filter: 'ebooks',
          format: null,
          orderBy: 'newest',
          page: 3,
          printType: null,
          query: 'Ada Author',
          subject: null,
          yearFrom: null,
          yearTo: null,
        },
      }),
    );

    element.querySelector<HTMLButtonElement>('.text-button')!.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          filter: null,
          format: null,
          orderBy: null,
          page: null,
          printType: null,
          query: 'Ada Author',
          subject: null,
          yearFrom: null,
          yearTo: null,
        },
      }),
    );
  });
});
