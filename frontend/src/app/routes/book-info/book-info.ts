import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { NormalizedBook, ShelfResponse } from '../../core/api/api.types';
import { Books as BooksService } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

/**
 * Info-only Google Books detail page. It shows provider metadata for search results without
 * creating a library item until the user explicitly saves an ISBN-backed book.
 */
@Component({
  selector: 'app-book-info',
  imports: [RouterLink, UiFormControl],
  templateUrl: './book-info.html',
  styleUrl: './book-info.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookInfo {
  private readonly addBookDialog = viewChild<ElementRef<HTMLDialogElement>>('addBookDialog');
  private readonly books = inject(BooksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);
  private readonly shelfPickerModel = signal({ shelfId: '' });

  protected readonly book = signal<NormalizedBook | null>(null);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingShelves = signal(true);
  protected readonly isAdding = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly shelfPickerForm = form(this.shelfPickerModel, (path) => {
    required(path.shelfId, { message: 'Choose a shelf.' });
  });
  /**
   * Loads provider detail from the route id and keeps shelf options fresh while the page is open.
   */
  public constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');

      if (id) {
        void this.loadBook(id);
      }
    });

    void this.loadShelves();
  }
  /**
   * Returns a cover URL only when the provider supplied one.
   */
  protected coverUrl(): string | null {
    const book = this.book();
    return book?.summary.coverImages.detail ?? book?.summary.coverUrl ?? null;
  }
  /**
   * Chooses the primary author for display and author search links.
   */
  protected primaryAuthor(): string {
    const book = this.book();
    return book?.summary.primaryAuthor ?? book?.summary.authors[0] ?? 'Unknown author';
  }
  /**
   * Returns the provider description or a sparse-data fallback.
   */
  protected description(): string {
    return (
      this.book()?.summary.description ?? 'No description is available for this Google Books volume.'
    );
  }
  /**
   * Returns whether this provider result has a saveable ISBN identity.
   */
  protected canSaveBook(): boolean {
    const book = this.book();
    return Boolean(book?.summary.isbn13 || book?.summary.isbn10);
  }
  /**
   * Opens the explicit add dialog when the book can be saved.
   */
  protected openAddDialog(): void {
    if (!this.canSaveBook()) {
      this.error.set('This Google Books result is missing an ISBN and cannot be saved.');
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.ensureSelectedShelf();
    this.addBookDialog()?.nativeElement.showModal();
  }
  /**
   * Closes the add dialog without changing provider detail state.
   */
  protected closeAddDialog(): void {
    this.addBookDialog()?.nativeElement.close();
  }
  /**
   * Adds this ISBN-backed book to the selected shelf and opens the personal detail page.
   */
  protected async submitAddBook(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const book = this.book();

    if (!book || !this.canSaveBook()) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.isAdding.set(true);

    try {
      const successful = await submit(this.shelfPickerForm, async (formTree) => {
        const item = await this.library.add({
          googleBooksVolumeId: book.summary.googleBooksVolumeId,
          isbn10: book.summary.isbn10,
          isbn13: book.summary.isbn13,
          shelfId: formTree().value().shelfId,
        });
        this.closeAddDialog();
        await this.router.navigate(['/app/book', item.id]);
      });

      if (!successful) {
        this.error.set('That book could not be added.');
      }
    } catch {
      this.error.set('That book could not be added.');
    } finally {
      this.isAdding.set(false);
    }
  }
  /**
   * Loads normalized Google volume detail through the backend cache endpoint.
   */
  private async loadBook(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.book.set(await this.books.googleDetail(id));
    } catch {
      this.error.set('Book information could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
  /**
   * Loads active shelves for the add dialog.
   */
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
  /**
   * Keeps the shelf picker pointed at an existing active shelf.
   */
  private ensureSelectedShelf(): void {
    const shelves = this.shelves();
    const currentShelfId = this.shelfPickerModel().shelfId;

    if (shelves.some((shelf) => shelf.id === currentShelfId)) {
      return;
    }

    this.shelfPickerModel.set({ shelfId: shelves[0]?.id ?? '' });
  }
}
