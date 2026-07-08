import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute } from '@angular/router';

import type { NormalizedBook, ShelfResponse } from '../../core/api/api.types';
import { Books } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';

@Component({
  selector: 'app-search',
  imports: [FormField],
  templateUrl: './search.html',
  styleUrl: './search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  private readonly addBookDialog = viewChild<ElementRef<HTMLDialogElement>>('addBookDialog');
  private readonly books = inject(Books);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly shelvesService = inject(Shelves);
  private readonly model = signal({ query: '' });
  private readonly shelfPickerModel = signal({ shelfId: '' });

  protected readonly results = signal<NormalizedBook[]>([]);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly selectedBook = signal<NormalizedBook | null>(null);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly addingKey = signal<string | null>(null);
  protected readonly isLoadingShelves = signal(true);
  protected readonly searchForm = form(this.model, (path) => {
    required(path.query, { message: 'Search terms are required.' });
    minLength(path.query, 2, { message: 'Use at least 2 characters.' });
  });
  protected readonly shelfPickerForm = form(this.shelfPickerModel, (path) => {
    required(path.shelfId, { message: 'Choose a shelf.' });
  });

  public constructor() {
    effect(() => {
      this.shelvesService.version();
      void this.loadShelves();
    });
  }

  protected async submitSearch(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.status.set(null);

    const successful = await submit(this.searchForm, async (formTree) => {
      const response = await this.books.search(formTree().value().query.trim(), 1, 10);
      this.results.set(response.items);
      this.total.set(response.total);
    });

    if (!successful) {
      this.error.set('Search failed.');
    }
  }

  protected openAddBookDialog(book: NormalizedBook): void {
    this.error.set(null);
    this.status.set(null);
    this.selectedBook.set(book);
    this.ensureSelectedShelf();
    this.addBookDialog()?.nativeElement.showModal();
  }

  protected closeAddBookDialog(): void {
    this.addBookDialog()?.nativeElement.close();
    this.selectedBook.set(null);
  }

  protected async submitAddBook(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const book = this.selectedBook();

    if (!book) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.addingKey.set(book.providerKey);

    try {
      const successful = await submit(this.shelfPickerForm, async (formTree) => {
        await this.library.add({ book, shelfId: formTree().value().shelfId });
        this.status.set(`${book.title} was added to your library.`);
        this.closeAddBookDialog();
      });

      if (!successful) {
        this.error.set('That book could not be added.');
      }
    } catch {
      this.error.set('That book could not be added.');
    } finally {
      this.addingKey.set(null);
    }
  }

  protected coverUrl(book: NormalizedBook): string | null {
    return typeof book.coverUrl === 'string' ? book.coverUrl : null;
  }

  protected primaryAuthor(book: NormalizedBook): string {
    return typeof book.primaryAuthor === 'string' ? book.primaryAuthor : book.authors[0] ?? 'Unknown author';
  }

  protected publishedDate(book: NormalizedBook): string {
    return typeof book.publishedDate === 'string' ? book.publishedDate : 'Unknown year';
  }

  private async loadShelves(): Promise<void> {
    this.isLoadingShelves.set(true);

    try {
      this.shelves.set(await this.shelvesService.list());
      this.ensureSelectedShelf();
    } catch {
      this.error.set('Shelves could not be loaded.');
    } finally {
      this.isLoadingShelves.set(false);
    }
  }

  private ensureSelectedShelf(): void {
    const shelves = this.shelves();
    const currentShelfId = this.shelfPickerModel().shelfId;
    const preferredShelfId = this.route.snapshot.queryParamMap.get('shelfId') ?? '';

    if (shelves.some((shelf) => shelf.id === currentShelfId)) {
      return;
    }

    const preferredShelf = shelves.find((shelf) => shelf.id === preferredShelfId);
    this.shelfPickerModel.set({ shelfId: preferredShelf?.id ?? shelves[0]?.id ?? '' });
  }
}
