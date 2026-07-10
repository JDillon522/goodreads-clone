import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import type { LibraryItemResponse, ShelfResponse } from '../../core/api/api.types';
import { Books as BooksService } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';
import { BookDetail } from './book-detail';

const timestamp = '2026-07-08T12:00:00.000Z';

const readShelf = { id: 'read', name: 'Read', position: 0, slug: 'read' };
const fantasyShelf = { id: 'fantasy', name: 'Fantasy', position: 1, slug: 'fantasy' };

function testBook(title = 'The Test Book'): LibraryItemResponse['book'] {
  return {
    google: {
      id: 'google-book-1',
      volumeInfo: {
        authors: ['Ada Author'],
        categories: ['Fantasy'],
        imageLinks: {
          thumbnail: null,
        },
        title,
      },
    },
    id: 'book-1',
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
      authors: ['Ada Author'],
      averageRating: null,
      categories: ['Fantasy'],
      coverImages: {
        card: null,
        detail: null,
        theme: null,
        thumbnail: null,
      },
      coverUrl: null,
      dedupeKey: 'google:google-book-1',
      description: null,
      ebookAccess: null,
      externalLinks: {
        buy: null,
        canonical: null,
        info: null,
        preview: null,
        webReader: null,
      },
      genres: ['Fantasy'],
      googleBooksVolumeId: 'google-book-1',
      isbn10: null,
      isbn13: '9780441478125',
      isReadableOnline: false,
      language: null,
      pageCount: 304,
      primaryAuthor: 'Ada Author',
      printType: 'BOOK',
      providerKey: 'google:google-book-1',
      publishedDate: '2026',
      publisher: 'Ace Books',
      ratingsCount: null,
      subtitle: null,
      title,
    },
    sync: {
      googleBooksError: null,
      googleBooksStatus: 'PENDING',
      googleBooksSyncedAt: null,
    },
  };
}

function shelf(summary: typeof readShelf, itemCount = 1): ShelfResponse {
  return {
    ...summary,
    createdAt: timestamp,
    deactivatedAt: null,
    isDefault: summary.id === 'read',
    itemCount,
    updatedAt: timestamp,
  };
}

function libraryItem(overrides: Partial<LibraryItemResponse> = {}): LibraryItemResponse {
  return {
    book: testBook(),
    createdAt: timestamp,
    currentPage: 12,
    dateAdded: timestamp,
    dedupeKey: 'sample:1',
    id: 'item-1',
    notes: 'Original note',
    rating: 3,
    shelves: [readShelf],
    status: 'READING',
    updatedAt: timestamp,
    ...overrides,
  };
}

class MockLibrary {
  private currentItem = libraryItem();
  public setCurrentItem(item: LibraryItemResponse): void {
    this.currentItem = item;
  }

  public readonly addShelf = vi.fn(async (_id: string, _request: { shelfId: string }) => {
    this.currentItem = { ...this.currentItem, shelves: [readShelf, fantasyShelf] };
    return this.currentItem;
  });
  public readonly get = vi.fn(async () => this.currentItem);
  public readonly delete = vi.fn(async () => undefined);
  public readonly removeShelf = vi.fn(async (_id: string, shelfId: string) => {
    this.currentItem = {
      ...this.currentItem,
      shelves: this.currentItem.shelves.filter((shelf) => shelf.id !== shelfId),
    };
    return this.currentItem;
  });
  public readonly update = vi.fn(async (_id: string, request: Partial<LibraryItemResponse>) => {
    this.currentItem = { ...this.currentItem, ...request };
    return this.currentItem;
  });
  public readonly updateProgress = vi.fn(
    async (_id: string, request: Partial<LibraryItemResponse>) => {
      this.currentItem = { ...this.currentItem, ...request };
      return this.currentItem;
    },
  );
}

class MockShelves {
  private readonly revision = signal(0);
  public readonly version = this.revision.asReadonly();
  public readonly list = vi.fn(async () => [shelf(readShelf), shelf(fantasyShelf, 0)]);
}

class MockTheme {
  public readonly useBookAsCustomTheme = vi.fn().mockResolvedValue(undefined);
}

class MockBooks {
  public readonly series = vi.fn(async () => ({
    bookId: 'book-1',
    entries: [
      {
        book: {
          authors: ['Ada Author'],
          coverUrl: null,
          genres: ['Fantasy'],
          id: 'book-1',
          primaryAuthor: 'Ada Author',
          publishedDate: '2026',
          sourceId: 'sample:1',
          sourceProvider: 'SAMPLE',
          sourceUrl: null,
          subtitle: null,
          title: 'The Test Book',
        },
        confidence: 88,
        position: 1,
        positionLabel: 'Book 1',
      },
      {
        book: {
          authors: ['Ada Author'],
          coverUrl: null,
          genres: ['Fantasy'],
          id: 'book-2',
          primaryAuthor: 'Ada Author',
          publishedDate: '2027',
          sourceId: 'sample:2',
          sourceProvider: 'SAMPLE',
          sourceUrl: null,
          subtitle: null,
          title: 'The Sequel',
        },
        confidence: 88,
        position: 2,
        positionLabel: 'Book 2',
      },
    ],
    seriesName: 'Test Cycle',
  }));
  public readonly related = vi.fn(async () => ({
    bookId: 'book-1',
    items: [
      {
        book: {
          authors: ['Ada Author'],
          coverUrl: null,
          genres: ['Fantasy'],
          id: 'book-2',
          primaryAuthor: 'Ada Author',
          publishedDate: '2027',
          sourceId: 'sample:2',
          sourceProvider: 'SAMPLE',
          sourceUrl: null,
          subtitle: null,
          title: 'The Sequel',
        },
        reasons: ['Same author', 'Shared genre: Fantasy'],
        score: 62,
      },
    ],
  }));
}

describe('BookDetail', () => {
  let books: MockBooks;
  let library: MockLibrary;
  let theme: MockTheme;

  beforeEach(async () => {
    books = new MockBooks();
    library = new MockLibrary();
    theme = new MockTheme();

    await TestBed.configureTestingModule({
      imports: [BookDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'item-1' })) },
        },
        { provide: BooksService, useValue: books },
        { provide: LibraryService, useValue: library },
        { provide: Shelves, useClass: MockShelves },
        { provide: Theme, useValue: theme },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the book and renders the rating and notes editor', async () => {
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const authorLink = element.querySelector<HTMLAnchorElement>('.author-link');

    expect(element.textContent).toContain('The Test Book');
    expect(element.textContent).toContain('Ace Books');
    expect(element.textContent).toContain('9780441478125');
    expect(element.textContent).toContain('Fantasy');
    expect(element.textContent).toContain('Test Cycle');
    expect(element.textContent).toContain('The Sequel');
    expect(books.series).toHaveBeenCalledWith('book-1');
    expect(books.related).toHaveBeenCalledWith('book-1', 12);
    expect(authorLink?.textContent?.trim()).toBe('Ada Author');
    expect(authorLink?.getAttribute('href')).toBe('/app/search?query=Ada%20Author');
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('READING');
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Original note');
  });

  it('updates status, shelf membership, progress, and review fields through the UI', async () => {
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const forms = () => Array.from(element.querySelectorAll<HTMLFormElement>('form'));
    const selects = () => Array.from(element.querySelectorAll<HTMLSelectElement>('select'));

    selects()[0].value = 'READ';
    selects()[0].dispatchEvent(new Event('input', { bubbles: true }));
    selects()[0].dispatchEvent(new Event('change', { bubbles: true }));
    forms()[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(library.update).toHaveBeenCalledWith('item-1', { status: 'READ' });

    selects()[1].value = 'fantasy';
    selects()[1].dispatchEvent(new Event('input', { bubbles: true }));
    selects()[1].dispatchEvent(new Event('change', { bubbles: true }));
    element
      .querySelector<HTMLFormElement>('.shelf-add-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(library.addShelf).toHaveBeenCalledWith('item-1', { shelfId: 'fantasy' });

    element.querySelector<HTMLButtonElement>('button[aria-label="Remove Read"]')!.click();
    await fixture.whenStable();
    expect(library.removeShelf).toHaveBeenCalledWith('item-1', 'read');

    const pageInput = element.querySelector<HTMLInputElement>('input[type="number"]')!;
    pageInput.value = '42';
    pageInput.dispatchEvent(new Event('input', { bubbles: true }));
    forms()[2].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(library.updateProgress).toHaveBeenCalledWith('item-1', {
      currentPage: 42,
      trackingMode: 'PAGE',
    });

    const reviewSelect = selects().at(-1)!;
    reviewSelect.value = '5';
    reviewSelect.dispatchEvent(new Event('input', { bubbles: true }));
    reviewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const notes = element.querySelector<HTMLTextAreaElement>('textarea')!;
    notes.value = 'Loved it.';
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    forms()
      .at(-1)!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(library.update).toHaveBeenLastCalledWith('item-1', { notes: 'Loved it.', rating: 5 });
  });

  it('uses the current book cover as a custom theme source', async () => {
    library.setCurrentItem(
      libraryItem({
        book: {
          ...testBook(),
          summary: {
            ...testBook().summary,
            coverImages: {
              ...testBook().summary.coverImages,
              detail: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
            },
            coverUrl: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
          },
        },
      }),
    );
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.cover-theme-button')!
      .click();
    await fixture.whenStable();

    expect(theme.useBookAsCustomTheme).toHaveBeenCalledWith('item-1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Theme updated from this cover.',
    );
  });

  it('removes the book from the detail page and returns to the library', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.danger-button')!.click();
    await fixture.whenStable();

    expect(library.delete).toHaveBeenCalledWith('item-1');
    expect(navigate).toHaveBeenCalledWith(['/app/library']);
  });
});
