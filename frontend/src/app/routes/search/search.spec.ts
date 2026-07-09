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
  return {
    authors: [query],
    dedupeKey: `query:${query}:${page}`,
    ebookAccess: page === 1 ? 'public' : null,
    genres: ['Fantasy'],
    isReadableOnline: page === 1,
    primaryAuthor: query,
    provider: 'OPEN_LIBRARY',
    providerKey: `works:${query}:${page}`,
    sourceId: `works:${query}:${page}`,
    title: `${query} Book ${page}`,
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
      formats: [{ count: 1, label: 'Readable online / eBook', value: 'ebook' }],
      publishedDecades: [{ count: 1, label: '2020s', value: '2020s', yearFrom: 2020, yearTo: 2029 }],
      subjects: [{ count: 1, label: 'Fantasy', value: 'Fantasy' }],
    },
    filters: {
      format: filters.format ?? null,
      subject: filters.subject ?? null,
      yearFrom: filters.yearFrom ?? null,
      yearTo: filters.yearTo ?? null,
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
  public readonly add = vi.fn();
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
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: MockRouter;

  beforeEach(async () => {
    books = new MockBooks();
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
        { provide: LibraryService, useClass: MockLibrary },
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
    expect(element.textContent).toContain('Filters');
    expect(element.textContent).toContain('2020s');
    expect(element.textContent).toContain('Fantasy');
    expect(element.textContent).toContain('Readable online / eBook');
    expect(element.textContent).toContain('Page 1 of 3');
  });

  it('runs a new search when the query string changes', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();

    queryParamMap.next(
      convertToParamMap({
        format: 'ebook',
        page: '2',
        query: 'Octavia Butler',
        subject: 'Fantasy',
        yearFrom: '2020',
        yearTo: '2029',
      }),
    );
    await waitForAsyncWork();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(books.search).toHaveBeenLastCalledWith('Octavia Butler', 2, 10, {
      format: 'ebook',
      subject: 'Fantasy',
      yearFrom: 2020,
      yearTo: 2029,
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
          format: null,
          page: 2,
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
    const subjectButton = Array.from(element.querySelectorAll<HTMLButtonElement>('.facet-chip')).find(
      (button) => button.textContent?.includes('Fantasy'),
    )!;

    subjectButton.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          format: null,
          page: null,
          query: 'Ada Author',
          subject: 'Fantasy',
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
        format: 'ebook',
        page: '2',
        query: 'Ada Author',
        subject: 'Fantasy',
        yearFrom: '2020',
        yearTo: '2029',
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
          format: 'ebook',
          page: 3,
          query: 'Ada Author',
          subject: 'Fantasy',
          yearFrom: 2020,
          yearTo: 2029,
        },
      }),
    );

    element.querySelector<HTMLButtonElement>('.text-button')!.click();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: {
          format: null,
          page: null,
          query: 'Ada Author',
          subject: null,
          yearFrom: null,
          yearTo: null,
        },
      }),
    );
  });
});
