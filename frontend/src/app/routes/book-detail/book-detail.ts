import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, max, maxLength, min, required, submit } from '@angular/forms/signals';

import type {
  LibraryItemResponse,
  LibraryItemStatus,
  ShelfResponse,
  ShelfSummaryResponse,
  UpdateLibraryItemRequest,
  UpdateProgressRequest,
} from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

type RatingFormValue = 'none' | '1' | '2' | '3' | '4' | '5';

@Component({
  selector: 'app-book-detail',
  imports: [RouterLink, UiFormControl],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDetail {
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly shelvesService = inject(Shelves);
  private readonly progressModel = signal({ trackingMode: 'PAGE' as 'PAGE' | 'PERCENT', currentPage: 0, currentPercent: 0 });
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

  protected coverUrl(): string | null {
    const item = this.item();
    return item && typeof item.book.coverUrl === 'string' ? item.book.coverUrl : null;
  }

  protected primaryAuthor(): string {
    const item = this.item();
    return item && typeof item.book.primaryAuthor === 'string' ? item.book.primaryAuthor : item?.book.authors[0] ?? 'Unknown author';
  }

  protected description(): string {
    const item = this.item();
    return item && typeof item.book.description === 'string' ? item.book.description : 'No description is available for this edition.';
  }

  protected shelfListLabel(): string {
    return this.itemShelves().map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }

  protected ratingLabel(rating: RatingFormValue): string {
    return rating === 'none' ? 'No rating' : `${rating} star${rating === '1' ? '' : 's'}`;
  }

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
        const updated = await this.library.addShelf(item.id, { shelfId: formTree().value().shelfId });
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
          rating: typeof updated.rating === 'number' ? (`${updated.rating}` as RatingFormValue) : 'none',
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

  private async loadBook(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const item = await this.library.get(id);
      this.item.set(item);
      this.statusModel.set({ status: item.status });
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
    } catch {
      this.error.set('Book could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadShelves(): Promise<void> {
    try {
      this.allShelves.set(await this.shelvesService.list());
      this.ensureSelectedMembershipShelf();
    } catch {
      this.error.set('Shelves could not be loaded.');
    }
  }

  private ensureSelectedMembershipShelf(): void {
    const availableShelves = this.availableShelves();
    const currentShelfId = this.shelfMembershipModel().shelfId;

    if (availableShelves.some((shelf) => shelf.id === currentShelfId)) {
      return;
    }

    this.shelfMembershipModel.set({ shelfId: availableShelves[0]?.id ?? '' });
  }
}
