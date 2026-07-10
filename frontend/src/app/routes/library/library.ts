import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';

/**
 * Main library route showing all books owned by the current user or guest.
 */
@Component({
  selector: 'app-library',
  imports: [RouterLink],
  templateUrl: './library.html',
  styleUrl: './library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Library {
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly deleteRevealTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly items = signal<LibraryItemResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly visibleDeleteItemId = signal<string | null>(null);
  protected readonly deletingItemId = signal<string | null>(null);
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
