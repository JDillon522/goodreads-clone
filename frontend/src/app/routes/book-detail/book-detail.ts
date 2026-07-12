import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, max, maxLength, min, required, submit } from '@angular/forms/signals';

import type {
  BookCardResponse,
  BookSeriesResponse,
  LibraryItemResponse,
  LibraryItemStatus,
  NormalizedBook,
  RelatedBookResponse,
  ShelfResponse,
  ShelfSummaryResponse,
  UpdateLibraryItemRequest,
  UpdateProgressRequest,
} from '../../core/api/api.types';
import { Books as BooksService } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

/**
 * Book detail route controller for a single library item.
 *
 * The screen coordinates three independent edits for the same item: reading
 * status, progress tracking, and personal review notes. It also keeps
 * multi-shelf membership in sync with the global shelf list.
 */
type RatingFormValue = 'none' | '1' | '2' | '3' | '4' | '5';

@Component({
  selector: 'app-book-detail',
  imports: [RouterLink, UiFormControl],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDetail {
  private readonly books = inject(BooksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);
  private readonly theme = inject(Theme);
  private readonly progressModel = signal({
    trackingMode: 'PAGE' as 'PAGE' | 'PERCENT',
    currentPage: 0,
    currentPercent: 0,
  });
  private readonly reviewModel = signal({ rating: 'none' as RatingFormValue, notes: '' });
  private readonly statusModel = signal({ status: 'WANT_TO_READ' as LibraryItemStatus });
  private readonly shelfMembershipModel = signal({ shelfId: '' });

  protected readonly item = signal<LibraryItemResponse | null>(null);
  protected readonly allShelves = signal<ShelfResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly addingShelf = signal(false);
  protected readonly removingShelfId = signal<string | null>(null);
  protected readonly applyingTheme = signal(false);
  protected readonly deletingBook = signal(false);
  protected readonly series = signal<BookSeriesResponse | null>(null);
  protected readonly relatedBooks = signal<RelatedBookResponse[]>([]);
  protected readonly similarEditions = signal<NormalizedBook[]>([]);
  protected readonly isLoadingRelations = signal(false);
  protected readonly relationsError = signal<string | null>(null);
  protected readonly replacingEditionId = signal<string | null>(null);
  protected readonly ratingOptions: readonly RatingFormValue[] = ['none', '1', '2', '3', '4', '5'];
  protected readonly itemShelves = computed<ShelfSummaryResponse[]>(() => {
    const item = this.item();

    if (!item) {
      return [];
    }

    const currentShelves = new Map(this.allShelves().map((shelf) => [shelf.id, shelf]));
    return item.shelves.map((shelf) => currentShelves.get(shelf.id) ?? shelf);
  });
  protected readonly availableShelves = computed<ShelfResponse[]>(() => {
    const itemShelfIds = new Set(this.itemShelves().map((shelf) => shelf.id));
    return this.allShelves().filter((shelf) => !itemShelfIds.has(shelf.id));
  });
  protected readonly progressForm = form(this.progressModel, (path) => {
    required(path.trackingMode);
    min(path.currentPage, 0);
    min(path.currentPercent, 0);
    max(path.currentPercent, 100);
  });
  protected readonly statusForm = form(this.statusModel, (path) => {
    required(path.status);
  });
  protected readonly reviewForm = form(this.reviewModel, (path) => {
    maxLength(path.notes, 5000, { message: 'Keep notes under 5000 characters.' });
  });
  protected readonly shelfMembershipForm = form(this.shelfMembershipModel, (path) => {
    required(path.shelfId);
  });
  /**
   * Reloads shelves whenever shelf mutations happen elsewhere and reloads the item when the route id changes.
   */
  public constructor() {
    effect(() => {
      this.shelvesService.version();
      void this.loadShelves();
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        void this.loadBook(id);
      }
    });
  }
  /**
   * Returns a cover image only when the stored book snapshot has one.
   */
  protected coverUrl(): string | null {
    const item = this.item();
    if (!item) {
      return null;
    }
    const summary = item.book.summary;
    return (
      summary.coverImages.detail ??
      summary.coverImages.card ??
      summary.coverImages.thumbnail ??
      summary.coverUrl ??
      null
    );
  }
  /**
   * Chooses the normalized primary author, falling back to the first author in the book snapshot.
   */
  protected primaryAuthor(): string {
    const item = this.item();
    return item?.book.summary.primaryAuthor ?? item?.book.summary.authors[0] ?? 'Unknown author';
  }
  /**
   * Returns a search query only for real author names so the template can hide the link fallback.
   */
  protected authorSearchQuery(): string | null {
    const author = this.primaryAuthor();

    return author === 'Unknown author' ? null : author;
  }
  /**
   * Returns the exact Google Books identity used by the provider-detail route.
   */
  protected googleVolumeId(book: BookCardResponse): null | string {
    return book.googleBooksVolumeId ?? null;
  }
  /**
   * Returns a compact author label for book cards.
   */
  protected cardAuthor(book: BookCardResponse): string {
    return book.primaryAuthor ?? book.authors[0] ?? 'Unknown author';
  }
  /**
   * Returns a compact author label for a full Google metadata response.
   */
  protected editionAuthor(book: NormalizedBook): string {
    return book.summary.primaryAuthor ?? book.summary.authors[0] ?? 'Unknown author';
  }
  /**
   * Replaces the saved ISBN identity while the backend retains personal state and clears progress.
   */
  protected async replaceEdition(edition: NormalizedBook): Promise<void> {
    const item = this.item();
    const volumeId = edition.summary.googleBooksVolumeId;

    if (!item || !volumeId) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.replacingEditionId.set(volumeId);

    try {
      const updated = await this.library.replaceEdition(item.id, {
        googleBooksVolumeId: volumeId,
      });
      this.item.set(updated);
      this.statusModel.set({ status: updated.status });
      this.progressModel.set({ trackingMode: 'PAGE', currentPage: 0, currentPercent: 0 });
      this.reviewModel.set({
        notes: updated.notes ?? '',
        rating:
          typeof updated.rating === 'number' ? (`${updated.rating}` as RatingFormValue) : 'none',
      });
      this.ensureSelectedMembershipShelf();
      this.status.set(
        `Edition replaced with ${updated.book.summary.title}. Reading progress was reset.`,
      );
      void this.loadBookRelations(updated.book.id);
    } catch {
      this.error.set('That edition could not replace the current library book.');
    } finally {
      this.replacingEditionId.set(null);
    }
  }
  /**
   * Shows the stored description or the no-description fallback for sparse Google Books records.
   */
  protected description(): string {
    const item = this.item();
    return item && typeof item.book.summary.description === 'string'
      ? item.book.summary.description
      : 'No description is available for this edition.';
  }
  /**
   * Formats shelf list label for display while keeping templates free of presentation logic.
   */
  protected shelfListLabel(): string {
    return (
      this.itemShelves()
        .map((shelf) => shelf.name)
        .join(', ') || 'Unshelved'
    );
  }
  /**
   * Formats rating label for display while keeping templates free of presentation logic.
   */
  protected ratingLabel(rating: RatingFormValue): string {
    return rating === 'none' ? 'No rating' : `${rating} star${rating === '1' ? '' : 's'}`;
  }
  /**
   * Saves the explicit reading status without changing progress-derived fields.
   */
  protected async submitStatus(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const item = this.item();

    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);

    try {
      const successful = await submit(this.statusForm, async (formTree) => {
        const updated = await this.library.update(item.id, { status: formTree().value().status });
        this.item.set(updated);
        this.statusModel.set({ status: updated.status });
        this.status.set('Status updated.');
      });

      if (!successful) {
        this.error.set('Status could not be updated.');
      }
    } catch {
      this.error.set('Status could not be updated.');
    }
  }
  /**
   * Adds the item to an additional shelf and refreshes the remaining available shelf options.
   */
  protected async submitAddShelf(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const item = this.item();

    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.addingShelf.set(true);

    try {
      const successful = await submit(this.shelfMembershipForm, async (formTree) => {
        const updated = await this.library.addShelf(item.id, {
          shelfId: formTree().value().shelfId,
        });
        this.item.set(updated);
        this.ensureSelectedMembershipShelf();
        this.status.set('Shelf added.');
      });

      if (!successful) {
        this.error.set('Shelf could not be added.');
      }
    } catch {
      this.error.set('Shelf could not be added.');
    } finally {
      this.addingShelf.set(false);
    }
  }
  /**
   * Removes one shelf membership while preserving any other shelves on the item.
   */
  protected async removeShelf(shelf: ShelfSummaryResponse): Promise<void> {
    const item = this.item();

    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.removingShelfId.set(shelf.id);

    try {
      const updated = await this.library.removeShelf(item.id, shelf.id);
      this.item.set(updated);
      this.ensureSelectedMembershipShelf();
      this.status.set(`${shelf.name} removed.`);
    } catch {
      this.error.set('Shelf could not be removed.');
    } finally {
      this.removingShelfId.set(null);
    }
  }
  /**
   * Generates and saves a custom app palette from this book's cover.
   */
  protected async useCoverAsTheme(): Promise<void> {
    const item = this.item();

    if (!item || !this.coverUrl()) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.applyingTheme.set(true);

    try {
      await this.theme.useBookAsCustomTheme(item.id);
      this.status.set('Theme updated from this cover.');
    } catch {
      this.error.set('This cover could not be used as a theme.');
    } finally {
      this.applyingTheme.set(false);
    }
  }
  /**
   * Removes this saved item from the current owner's library and returns to the library grid.
   */
  protected async deleteBook(): Promise<void> {
    const item = this.item();

    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.deletingBook.set(true);

    try {
      await this.library.delete(item.id);
      await this.router.navigate(['/app/library']);
    } catch {
      this.error.set('Book could not be removed from your library.');
    } finally {
      this.deletingBook.set(false);
    }
  }
  /**
   * Saves page or percent progress using the DTO shape required by the selected tracking mode.
   */
  protected async submitProgress(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const item = this.item();
    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);

    try {
      const successful = await submit(this.progressForm, async (formTree) => {
        const value = formTree().value();
        // The backend accepts exactly one progress mode at a time, so the inactive
        // numeric field is intentionally omitted instead of sent as zero.
        const request: UpdateProgressRequest =
          value.trackingMode === 'PAGE'
            ? { trackingMode: 'PAGE', currentPage: value.currentPage }
            : { trackingMode: 'PERCENT', currentPercent: value.currentPercent };

        const updated = await this.library.updateProgress(item.id, request);
        this.item.set(updated);
        this.status.set('Progress updated.');
      });

      if (!successful) {
        this.error.set('Progress could not be updated.');
      }
    } catch {
      this.error.set('Progress could not be updated.');
    }
  }
  /**
   * Saves personal rating and notes, converting clear UI values to API nulls.
   */
  protected async submitReview(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const item = this.item();

    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);

    try {
      const successful = await submit(this.reviewForm, async (formTree) => {
        const value = formTree().value();
        const notes = value.notes.trim();
        const request: UpdateLibraryItemRequest = {
          notes: notes || null,
          rating: value.rating === 'none' ? null : Number(value.rating),
        };
        const updated = await this.library.update(item.id, request);

        this.item.set(updated);
        this.reviewModel.set({
          notes: updated.notes ?? '',
          rating:
            typeof updated.rating === 'number' ? (`${updated.rating}` as RatingFormValue) : 'none',
        });
        this.status.set('Review notes updated.');
      });

      if (!successful) {
        this.error.set('Review notes could not be updated.');
      }
    } catch {
      this.error.set('Review notes could not be updated.');
    }
  }
  /**
   * Loads the item and seeds each edit form from the persisted state.
   */
  private async loadBook(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const item = await this.library.get(id);
      this.item.set(item);
      this.statusModel.set({ status: item.status });
      // Percent progress wins when present because page and percent are mutually
      // exclusive modes in the edit form even if historical data has both fields.
      this.progressModel.set({
        trackingMode: typeof item.currentPercent === 'number' ? 'PERCENT' : 'PAGE',
        currentPage: typeof item.currentPage === 'number' ? item.currentPage : 0,
        currentPercent: typeof item.currentPercent === 'number' ? item.currentPercent : 0,
      });
      this.reviewModel.set({
        notes: item.notes ?? '',
        rating: typeof item.rating === 'number' ? (`${item.rating}` as RatingFormValue) : 'none',
      });
      this.ensureSelectedMembershipShelf();
      void this.loadBookRelations(item.book.id);
    } catch {
      this.error.set('Book could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
  /**
   * Loads shelves used to compute current memberships and addable shelf options.
   */
  private async loadShelves(): Promise<void> {
    try {
      this.allShelves.set(await this.shelvesService.list());
      this.ensureSelectedMembershipShelf();
    } catch {
      this.error.set('Shelves could not be loaded.');
    }
  }
  /**
   * Loads series, related books, and similar editions without blocking the editable forms.
   */
  private async loadBookRelations(bookId: string): Promise<void> {
    this.isLoadingRelations.set(true);
    this.relationsError.set(null);
    this.series.set(null);
    this.relatedBooks.set([]);
    this.similarEditions.set([]);

    const [seriesResult, relatedResult, editionsResult] = await Promise.allSettled([
      this.books.series(bookId),
      this.books.related(bookId, 12),
      this.books.similarEditions(bookId, 6),
    ]);
    const currentBookId = this.item()?.book.id;

    if (currentBookId !== bookId) {
      return;
    }

    if (seriesResult.status === 'fulfilled') {
      this.series.set(seriesResult.value);
    } else {
      this.relationsError.set('Series could not be loaded.');
    }

    if (relatedResult.status === 'fulfilled') {
      this.relatedBooks.set(relatedResult.value.items);
    } else {
      this.relationsError.set('Related books could not be loaded.');
    }

    if (editionsResult.status === 'fulfilled') {
      this.similarEditions.set(editionsResult.value.items);
    } else {
      this.relationsError.set('Similar editions could not be loaded.');
    }

    this.isLoadingRelations.set(false);
  }
  /**
   * Keeps the add-shelf picker pointed at an available shelf after item or shelf updates.
   */
  private ensureSelectedMembershipShelf(): void {
    const availableShelves = this.availableShelves();
    const currentShelfId = this.shelfMembershipModel().shelfId;

    if (availableShelves.some((shelf) => shelf.id === currentShelfId)) {
      return;
    }

    this.shelfMembershipModel.set({ shelfId: availableShelves[0]?.id ?? '' });
  }
}
