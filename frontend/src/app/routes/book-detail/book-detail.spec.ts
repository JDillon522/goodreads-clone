import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import type { LibraryItemResponse, ShelfResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { BookDetail } from './book-detail';

const timestamp = '2026-07-08T12:00:00.000Z';

const readShelf = { id: 'read', name: 'Read', position: 0, slug: 'read' };
const fantasyShelf = { id: 'fantasy', name: 'Fantasy', position: 1, slug: 'fantasy' };

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
    book: {
      authors: ['Ada Author'],
      genres: ['Fantasy'],
      id: 'book-1',
      sourceId: 'sample:1',
      sourceProvider: 'SAMPLE',
      title: 'The Test Book',
    },
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

  public readonly addShelf = vi.fn(async (_id: string, _request: { shelfId: string }) => {
    this.currentItem = { ...this.currentItem, shelves: [readShelf, fantasyShelf] };
    return this.currentItem;
  });
  public readonly get = vi.fn(async () => this.currentItem);
  public readonly removeShelf = vi.fn(async (_id: string, shelfId: string) => {
    this.currentItem = { ...this.currentItem, shelves: this.currentItem.shelves.filter((shelf) => shelf.id !== shelfId) };
    return this.currentItem;
  });
  public readonly update = vi.fn(async (_id: string, request: Partial<LibraryItemResponse>) => {
    this.currentItem = { ...this.currentItem, ...request };
    return this.currentItem;
  });
  public readonly updateProgress = vi.fn(async (_id: string, request: Partial<LibraryItemResponse>) => {
    this.currentItem = { ...this.currentItem, ...request };
    return this.currentItem;
  });
}

class MockShelves {
  private readonly revision = signal(0);
  public readonly version = this.revision.asReadonly();
  public readonly list = vi.fn(async () => [shelf(readShelf), shelf(fantasyShelf, 0)]);
}

describe('BookDetail', () => {
  let library: MockLibrary;

  beforeEach(async () => {
    library = new MockLibrary();

    await TestBed.configureTestingModule({
      imports: [BookDetail],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'item-1' })) } },
        { provide: LibraryService, useValue: library },
        { provide: Shelves, useClass: MockShelves },
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

    expect(element.textContent).toContain('The Test Book');
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
    element.querySelector<HTMLFormElement>('.shelf-add-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
    expect(library.updateProgress).toHaveBeenCalledWith('item-1', { currentPage: 42, trackingMode: 'PAGE' });

    const reviewSelect = selects().at(-1)!;
    reviewSelect.value = '5';
    reviewSelect.dispatchEvent(new Event('input', { bubbles: true }));
    reviewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const notes = element.querySelector<HTMLTextAreaElement>('textarea')!;
    notes.value = 'Loved it.';
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    forms().at(-1)!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(library.update).toHaveBeenLastCalledWith('item-1', { notes: 'Loved it.', rating: 5 });
  });
});
