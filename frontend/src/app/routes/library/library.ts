import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  private readonly library = inject(LibraryService);

  protected readonly items = signal<LibraryItemResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  /**
   * Loads the full library once when the route is created.
   */
  public constructor() {
    void this.loadLibrary();
  }
  /**
   * Returns a cover URL only when the stored book snapshot has one.
   */
  protected coverUrl(item: LibraryItemResponse): string | null {
    return typeof item.book.coverUrl === 'string' ? item.book.coverUrl : null;
  }
  /**
   * Chooses the normalized primary author, falling back to the first stored author.
   */
  protected primaryAuthor(item: LibraryItemResponse): string {
    return typeof item.book.primaryAuthor === 'string'
      ? item.book.primaryAuthor
      : (item.book.authors[0] ?? 'Unknown author');
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
}
