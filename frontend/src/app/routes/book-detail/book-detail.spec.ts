import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import type {
  BookshelfBookLocation,
  LibraryItemResponse,
  ShelfResponse,
} from '../../core/api/api.types';
import { Books as BooksService } from '../../core/books/books';
import { Bookshelves } from '../../core/bookshelves/bookshelves';
import { Library as LibraryService } from '../../core/library/library';
import { SessionStore } from '../../core/session/session-store';
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
  public readonly replaceEdition = vi.fn(
    async (_id: string, _request: { googleBooksVolumeId: string }) => {
      const replacement = testBook('The Test Book: Deluxe Edition');
      replacement.id = 'book-edition';
      replacement.summary.googleBooksVolumeId = 'google-edition';
      replacement.summary.publisher = 'Deluxe Press';
      this.currentItem = {
        ...this.currentItem,
        book: replacement,
        currentPage: undefined,
      };
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

class MockSessionStore {
  public readonly isSignedIn = signal(true);
}

class MockBookshelves {
  public readonly locations = vi.fn(async (): Promise<BookshelfBookLocation[]> => [
    {
      boundingBox: { height: 600, rotationDegrees: 0, width: 80, x: 100, y: 120 },
      detectionId: 'detection-1',
      imageHeight: 800,
      imageWidth: 1200,
      photoCreatedAt: timestamp,
      photoId: 'photo-1',
      photoLabel: 'Office shelf',
      position: 2,
    },
  ]);
  public readonly image = vi.fn(async () => new Blob(['thumbnail'], { type: 'image/webp' }));
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
          googleBooksVolumeId: 'google-book-1',
          id: 'book-1',
          primaryAuthor: 'Ada Author',
          publishedDate: '2026',
          sourceId: 'isbn13:9780441478125',
          sourceProvider: 'GOOGLE_BOOKS',
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
          googleBooksVolumeId: 'google-book-2',
          id: 'book-2',
          primaryAuthor: 'Ada Author',
          publishedDate: '2027',
          sourceId: 'isbn13:9780441478126',
          sourceProvider: 'GOOGLE_BOOKS',
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
          googleBooksVolumeId: 'google-book-2',
          id: 'book-2',
          primaryAuthor: 'Ada Author',
          publishedDate: '2027',
          sourceId: 'isbn13:9780441478126',
          sourceProvider: 'GOOGLE_BOOKS',
          sourceUrl: null,
          subtitle: null,
          title: 'The Sequel',
        },
        reasons: ['Same author', 'Shared genre: Fantasy'],
        score: 62,
      },
    ],
  }));
  public readonly similarEditions = vi.fn(async () => {
    const edition = testBook('The Test Book: Deluxe Edition');
    edition.id = 'book-edition';
    edition.summary.googleBooksVolumeId = 'google-edition';
    edition.summary.isbn13 = '9780441478996';
    edition.summary.publisher = 'Deluxe Press';

    return { bookId: 'book-1', items: [edition] };
  });
}

describe('BookDetail', () => {
  let books: MockBooks;
  let bookshelves: MockBookshelves;
  let library: MockLibrary;
  let theme: MockTheme;

  beforeEach(async () => {
    books = new MockBooks();
    bookshelves = new MockBookshelves();
    library = new MockLibrary();
    theme = new MockTheme();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:bookshelf-thumbnail'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    await TestBed.configureTestingModule({
      imports: [BookDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'item-1' })) },
        },
        { provide: BooksService, useValue: books },
        { provide: Bookshelves, useValue: bookshelves },
        { provide: LibraryService, useValue: library },
        { provide: SessionStore, useClass: MockSessionStore },
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
    expect(books.similarEditions).toHaveBeenCalledWith('book-1', 6);
    expect(authorLink?.textContent?.trim()).toBe('Ada Author');
    expect(authorLink?.getAttribute('href')).toBe('/app/search?query=Ada%20Author');
    expect(element.querySelector<HTMLAnchorElement>('.related-card')?.getAttribute('href')).toBe(
      '/app/book-info/google/google-book-2',
    );
    expect(element.querySelector<HTMLSelectElement>('select')?.value).toBe('READING');
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Original note');
  });

  it('keeps the book identity together in a bounded overview card with controls beside it', async () => {
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const overview = element.querySelector<HTMLElement>('.book-overview-card')!;
    const controls = element.querySelector<HTMLElement>('.book-controls')!;

    expect(overview.querySelector('.cover-stack')).not.toBeNull();
    expect(overview.querySelector('.book-copy')).not.toBeNull();
    expect(overview.querySelector('.metadata-grid')).not.toBeNull();
    expect(overview.querySelector('.actions')).not.toBeNull();
    expect(getComputedStyle(overview).maxInlineSize).toBe('64rem');
    expect(controls.querySelector('.status-panel')).not.toBeNull();
    expect(controls.querySelector('.shelves-panel')).not.toBeNull();
    expect(controls.querySelector('.progress-panel')).not.toBeNull();
  });

  it('shows the physical bookshelf location with only this book highlighted', async () => {
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const location = element.querySelector<HTMLAnchorElement>('.location-card')!;
    const region = location.querySelector<HTMLElement>('.location-region')!;

    expect(bookshelves.locations).toHaveBeenCalledWith('item-1');
    expect(bookshelves.image).toHaveBeenCalledWith('photo-1', true);
    expect(location.textContent).toContain('Office shelf');
    expect(location.getAttribute('href')).toBe(
      '/app/bookshelves?photo=photo-1&detection=detection-1',
    );
    expect(location.querySelectorAll('.location-region')).toHaveLength(1);
    expect(region.style.left).toBe('10%');
    expect(region.style.top).toBe('12%');
  });

  it('replaces the saved edition while keeping the library item route', async () => {
    const fixture = TestBed.createComponent(BookDetail);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Similar editions');
    expect(element.textContent).toContain('Deluxe Press');

    element.querySelector<HTMLButtonElement>('.edition-replace-button')!.click();
    await fixture.whenStable();

    expect(library.replaceEdition).toHaveBeenCalledWith('item-1', {
      googleBooksVolumeId: 'google-edition',
    });
    expect(element.textContent).toContain('Reading progress was reset.');
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
              detail: 'https://books.google.com/books/content?id=google-book-1&img=1&zoom=1',
            },
            coverUrl: 'https://books.google.com/books/content?id=google-book-1&img=1&zoom=1',
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

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.danger-button')!
      .click();
    await fixture.whenStable();

    expect(library.delete).toHaveBeenCalledWith('item-1');
    expect(navigate).toHaveBeenCalledWith(['/app/library']);
  });
});
