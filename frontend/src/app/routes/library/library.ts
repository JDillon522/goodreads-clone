import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { UiFormControl } from '../../shared/ui/form-control/form-control';
import { LibraryTable } from './library-table';

type CardDensity = 'DENSE' | 'EXPANDED' | 'MEDIUM';
type LibraryDisplayMode = 'CARDS' | 'TABLE';

/**
 * Main library route showing all books owned by the current user or guest.
 */
@Component({
  selector: 'app-library',
  imports: [LibraryTable, RouterLink, UiFormControl],
  templateUrl: './library.html',
  styleUrl: './library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Library {
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly deleteRevealTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly filterModel = signal({ query: '' });

  protected readonly items = signal<LibraryItemResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly visibleDeleteItemId = signal<string | null>(null);
  protected readonly deletingItemId = signal<string | null>(null);
  protected readonly displayMode = signal<LibraryDisplayMode>('CARDS');
  protected readonly cardDensity = signal<CardDensity>('DENSE');
  protected readonly densityOptions: readonly CardDensity[] = ['DENSE', 'MEDIUM', 'EXPANDED'];
  protected readonly expandedTableItemId = signal<string | null>(null);
  protected readonly tablePage = signal(1);
  protected readonly tablePageSize = 10;
  protected readonly filterForm = form(this.filterModel);
  protected readonly filteredItems = computed(() => {
    const query = this.filterModel().query.trim();

    return query ? this.items().filter((item) => matchesLibraryQuery(item, query)) : this.items();
  });
  protected readonly tableTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItems().length / this.tablePageSize)),
  );
  protected readonly tableItems = computed(() => {
    const start = (this.tablePage() - 1) * this.tablePageSize;
    return this.filteredItems().slice(start, start + this.tablePageSize);
  });
  protected readonly tableRangeStart = computed(() => {
    if (this.tableItems().length === 0) {
      return 0;
    }

    return (this.tablePage() - 1) * this.tablePageSize + 1;
  });
  protected readonly tableRangeEnd = computed(() => {
    if (this.tableItems().length === 0) {
      return 0;
    }

    return this.tableRangeStart() + this.tableItems().length - 1;
  });
  /**
   * Loads the full library once when the route is created.
   */
  public constructor() {
    this.destroyRef.onDestroy(() => {
      for (const timer of this.deleteRevealTimers.values()) {
        clearTimeout(timer);
      }

      this.deleteRevealTimers.clear();
    });
    void this.loadLibrary();
  }
  /**
   * Returns the best card-sized cover URL from the shared provider metadata.
   */
  protected coverUrl(item: LibraryItemResponse): string | null {
    return item.book.summary.coverImages.card ?? item.book.summary.coverUrl ?? null;
  }
  /**
   * Chooses the computed primary author, falling back to the first provider author label.
   */
  protected primaryAuthor(item: LibraryItemResponse): string {
    return item.book.summary.primaryAuthor ?? item.book.summary.authors[0] ?? 'Unknown author';
  }
  /**
   * Formats progress label for display while keeping templates free of presentation logic.
   */
  protected progressLabel(item: LibraryItemResponse): string {
    if (typeof item.currentPage === 'number') {
      return `${item.currentPage} pages`;
    }

    if (typeof item.currentPercent === 'number') {
      return `${item.currentPercent}%`;
    }

    return 'No progress yet';
  }
  /**
   * Formats shelf label for display while keeping templates free of presentation logic.
   */
  protected shelfLabel(item: LibraryItemResponse): string {
    return item.shelves.map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }
  /**
   * Returns a readable library status label for cards and table rows.
   */
  protected statusLabel(item: LibraryItemResponse): string {
    switch (item.status) {
      case 'READ':
        return 'Read';
      case 'READING':
        return 'Currently reading';
      default:
        return 'Want to read';
    }
  }
  /**
   * Formats provider metadata that becomes visible at medium and expanded density.
   */
  protected publicationLabel(item: LibraryItemResponse): string {
    return [item.book.summary.publishedDate, item.book.summary.publisher]
      .filter((value): value is string => Boolean(value))
      .join(' · ');
  }
  /**
   * Returns the stored description or the sparse-metadata fallback.
   */
  protected description(item: LibraryItemResponse): string {
    return item.book.summary.description ?? 'No description is available for this edition.';
  }
  /**
   * Shows a stable ISBN label in expanded cards and table details.
   */
  protected isbnLabel(item: LibraryItemResponse): string {
    return item.book.summary.isbn13 ?? item.book.summary.isbn10 ?? 'Missing';
  }
  /**
   * Formats a compact rating label without implying that an unrated book has zero stars.
   */
  protected ratingLabel(item: LibraryItemResponse): string {
    return typeof item.rating === 'number' ? `${item.rating}/5` : 'Not rated';
  }
  /**
   * Resets table position whenever the local search text changes.
   */
  protected resetFilteredView(): void {
    this.tablePage.set(1);
    this.expandedTableItemId.set(null);
  }
  /**
   * Clears the library-only search without issuing a provider request.
   */
  protected clearFilter(): void {
    this.filterModel.set({ query: '' });
    this.resetFilteredView();
  }
  /**
   * Selects the card or table presentation while retaining the current library filter.
   */
  protected setDisplayMode(mode: LibraryDisplayMode): void {
    this.displayMode.set(mode);
    this.expandedTableItemId.set(null);
  }
  /**
   * Selects how much metadata each library card renders.
   */
  protected setCardDensity(density: CardDensity): void {
    this.cardDensity.set(density);
  }
  /**
   * Expands one table row at a time to reveal its provider overview.
   */
  protected toggleTableRow(itemId: string): void {
    this.expandedTableItemId.update((current) => (current === itemId ? null : itemId));
  }
  /**
   * Moves within the filtered table result set and collapses an old page's expanded row.
   */
  protected goToTablePage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.tableTotalPages());
    this.tablePage.set(nextPage);
    this.expandedTableItemId.set(null);
  }
  /**
   * Starts the delayed hover reveal for the destructive card action.
   */
  protected scheduleDeleteReveal(itemId: string): void {
    this.clearDeleteRevealTimer(itemId);
    this.deleteRevealTimers.set(
      itemId,
      setTimeout(() => {
        this.visibleDeleteItemId.set(itemId);
        this.deleteRevealTimers.delete(itemId);
      }, 2000),
    );
  }
  /**
   * Hides the delete affordance when the pointer leaves the card shell.
   */
  protected hideDeleteControl(itemId: string): void {
    this.clearDeleteRevealTimer(itemId);

    if (this.visibleDeleteItemId() === itemId && this.deletingItemId() !== itemId) {
      this.visibleDeleteItemId.set(null);
    }
  }
  /**
   * Reveals the delete button immediately for keyboard users tabbing through cards.
   */
  protected showDeleteControl(itemId: string): void {
    this.clearDeleteRevealTimer(itemId);
    this.visibleDeleteItemId.set(itemId);
  }
  /**
   * Keeps focus moving inside the card shell from hiding the delete button.
   */
  protected hideDeleteControlAfterFocusLeaves(itemId: string, event: FocusEvent): void {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(nextTarget)) {
        return;
      }
    }

    this.hideDeleteControl(itemId);
  }
  /**
   * Removes the item from the library and updates the visible grid without a full reload.
   */
  protected async deleteBook(item: LibraryItemResponse): Promise<void> {
    this.clearDeleteRevealTimer(item.id);
    this.error.set(null);
    this.deletingItemId.set(item.id);
    this.visibleDeleteItemId.set(item.id);

    try {
      await this.library.delete(item.id);
      this.items.update((items) => items.filter((candidate) => candidate.id !== item.id));
      this.visibleDeleteItemId.set(null);
      this.expandedTableItemId.set(null);
      this.tablePage.set(Math.min(this.tablePage(), this.tableTotalPages()));
    } catch {
      this.error.set('Book could not be removed from your library.');
    } finally {
      this.deletingItemId.set(null);
    }
  }
  /**
   * Loads every library item and toggles first-load state for the route.
   */
  private async loadLibrary(): Promise<void> {
    try {
      this.items.set(await this.library.list());
    } catch {
      this.error.set('Library could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
  /**
   * Cancels a pending delayed reveal timer for one card.
   */
  private clearDeleteRevealTimer(itemId: string): void {
    const timer = this.deleteRevealTimers.get(itemId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.deleteRevealTimers.delete(itemId);
  }
}

/** Matches the title, author, ISBN, and subject fields advertised by the provider search screen. */
function matchesLibraryQuery(item: LibraryItemResponse, query: string): boolean {
  const summary = item.book.summary;
  const haystack = normalizeSearchText(
    [
      summary.title,
      summary.subtitle,
      ...summary.authors,
      summary.primaryAuthor,
      summary.isbn10,
      summary.isbn13,
      ...summary.categories,
      ...summary.genres,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' '),
  );
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
