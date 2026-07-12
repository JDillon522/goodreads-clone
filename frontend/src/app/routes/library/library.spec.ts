import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { Library } from './library';

const timestamp = '2026-07-08T12:00:00.000Z';

type TestLibraryItemOptions = {
  author?: string;
  genres?: string[];
  id?: string;
  isbn13?: string;
  title?: string;
};

function libraryItem(options: TestLibraryItemOptions = {}): LibraryItemResponse {
  const id = options.id ?? 'item-1';
  const author = options.author ?? 'Ada Author';
  const isbn13 = options.isbn13 ?? '9780441478125';
  const title = options.title ?? 'The Test Book';
  const genres = options.genres ?? ['Fantasy'];
  const coverUrl = `https://books.google.com/books/content?id=google-${id}&img=1&zoom=1`;

  return {
    book: {
      google: null,
      id: `book-${id}`,
      summary: {
        authors: [author],
        averageRating: null,
        categories: genres,
        coverImages: {
          card: coverUrl,
          detail: coverUrl,
          theme: null,
          thumbnail: null,
        },
        coverUrl,
        dedupeKey: `isbn13:${isbn13}`,
        description: 'A detailed test description for the expanded catalog view.',
        ebookAccess: null,
        externalLinks: {
          buy: null,
          canonical: null,
          info: null,
          preview: null,
          webReader: null,
        },
        genres,
        googleBooksVolumeId: `google-${id}`,
        isbn10: null,
        isbn13,
        isReadableOnline: false,
        language: null,
        pageCount: 304,
        primaryAuthor: author,
        printType: 'BOOK',
        providerKey: `google:google-${id}`,
        publishedDate: '2026',
        publisher: 'Ace Books',
        ratingsCount: null,
        subtitle: null,
        title,
      },
      sync: {
        googleBooksError: null,
        googleBooksStatus: 'SYNCED',
        googleBooksSyncedAt: null,
      },
    },
    createdAt: timestamp,
    currentPage: null,
    currentPercent: null,
    dateAdded: timestamp,
    dateFinished: null,
    dedupeKey: `isbn13:${isbn13}`,
    id,
    notes: null,
    progressUpdatedAt: null,
    rating: null,
    shelves: [{ id: 'read', name: 'Read', position: 0, slug: 'read' }],
    status: 'WANT_TO_READ',
    updatedAt: timestamp,
  };
}

class MockLibrary {
  private items = [libraryItem()];

  public setItems(items: LibraryItemResponse[]): void {
    this.items = items;
  }

  public readonly delete = vi.fn(async () => undefined);
  public readonly list = vi.fn(async () => this.items);
}

describe('Library', () => {
  let library: MockLibrary;

  beforeEach(async () => {
    library = new MockLibrary();

    await TestBed.configureTestingModule({
      imports: [Library],
      providers: [provideRouter([]), { provide: LibraryService, useValue: library }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('reveals the delete button after hovering on a book card and removes the book', async () => {
    const fixture = TestBed.createComponent(Library);
    await fixture.whenStable();
    fixture.detectChanges();

    vi.useFakeTimers();

    const element = fixture.nativeElement as HTMLElement;
    const cardShell = element.querySelector<HTMLElement>('.book-card-shell')!;
    const deleteButton = element.querySelector<HTMLButtonElement>('.book-delete-button')!;

    expect(deleteButton.classList.contains('is-visible')).toBe(false);

    cardShell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(1999);
    fixture.detectChanges();
    expect(deleteButton.classList.contains('is-visible')).toBe(false);

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(deleteButton.classList.contains('is-visible')).toBe(true);

    deleteButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(library.delete).toHaveBeenCalledWith('item-1');
    expect(element.textContent).toContain('No books yet');
  });

  it('filters saved books by title, author, ISBN, and subject without calling provider search', async () => {
    library.setItems([
      libraryItem({
        id: 'road',
        title: 'The Road',
        author: 'Cormac McCarthy',
        genres: ['Fiction'],
      }),
      libraryItem({
        id: 'earthsea',
        title: 'A Wizard of Earthsea',
        author: 'Ursula K. Le Guin',
        genres: ['Fantasy'],
        isbn13: '9780547773742',
      }),
    ]);
    const fixture = TestBed.createComponent(Library);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;

    for (const [query, expectedTitle] of [
      ['road', 'The Road'],
      ['Le Guin', 'A Wizard of Earthsea'],
      ['9780547773742', 'A Wizard of Earthsea'],
      ['fiction', 'The Road'],
    ]) {
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();

      const cards = Array.from(element.querySelectorAll<HTMLElement>('.book-card__title'));
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain(expectedTitle);
    }

    expect(library.list).toHaveBeenCalledTimes(1);
  });

  it('switches card density and reveals progressively richer metadata', async () => {
    const fixture = TestBed.createComponent(Library);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.segmented-control button')).find(
        (candidate) => candidate.textContent?.trim() === label,
      )!;

    expect(element.querySelector('.book-grid--dense')).not.toBeNull();
    expect(
      getComputedStyle(element.querySelector<HTMLElement>('.book-grid')!).gridTemplateColumns,
    ).toContain('18rem');
    expect(element.querySelector('.book-card__publication')).toBeNull();

    button('Medium').click();
    await fixture.whenStable();
    expect(element.querySelector('.book-grid--medium')).not.toBeNull();
    expect(
      getComputedStyle(element.querySelector<HTMLElement>('.book-grid')!).gridTemplateColumns,
    ).toContain('26rem');
    expect(element.textContent).toContain('2026 · Ace Books');
    expect(element.textContent).toContain('Want to read');

    button('Expanded').click();
    await fixture.whenStable();
    expect(element.querySelector('.book-grid--expanded')).not.toBeNull();
    expect(
      getComputedStyle(element.querySelector<HTMLElement>('.book-grid')!).gridTemplateColumns,
    ).toContain('36rem');
    expect(element.textContent).toContain('A detailed test description');
    expect(element.textContent).toContain('Not rated');
  });

  it('paginates the thumbnail-free table and expands a row into a book overview', async () => {
    library.setItems(
      Array.from({ length: 12 }, (_, index) =>
        libraryItem({ id: `item-${index + 1}`, title: `Book ${index + 1}` }),
      ),
    );
    const fixture = TestBed.createComponent(Library);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => candidate.textContent?.trim() === label,
      )!;

    button('Table').click();
    await fixture.whenStable();

    expect(element.querySelectorAll('.library-table__row')).toHaveLength(10);
    expect(element.querySelector('.library-table img')).toBeNull();
    expect(element.textContent).toContain('Page 1 of 2');

    element.querySelector<HTMLElement>('.library-table__row')!.click();
    await fixture.whenStable();

    const overview = element.querySelector<HTMLElement>('.table-book-overview')!;
    expect(overview.textContent).toContain('A detailed test description');
    expect(overview.textContent).toContain('Ace Books');
    expect(overview.querySelector<HTMLImageElement>('img')?.src).toContain('books.google.com');
    expect(overview.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe(
      '/app/book/item-1',
    );

    button('Next').click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.library-table__row')).toHaveLength(2);
    expect(element.textContent).toContain('Page 2 of 2');
    expect(element.querySelector('.table-book-overview')).toBeNull();
  });
});
