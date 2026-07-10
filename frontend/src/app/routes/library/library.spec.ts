import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { Library } from './library';

const timestamp = '2026-07-08T12:00:00.000Z';

function libraryItem(): LibraryItemResponse {
  return {
    book: {
      google: null,
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
        dedupeKey: 'isbn13:9780441478125',
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
        title: 'The Test Book',
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
    dedupeKey: 'isbn13:9780441478125',
    id: 'item-1',
    notes: null,
    progressUpdatedAt: null,
    rating: null,
    shelves: [{ id: 'read', name: 'Read', position: 0, slug: 'read' }],
    status: 'WANT_TO_READ',
    updatedAt: timestamp,
  };
}

class MockLibrary {
  public readonly delete = vi.fn(async () => undefined);
  public readonly list = vi.fn(async () => [libraryItem()]);
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
});
