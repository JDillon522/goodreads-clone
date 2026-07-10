import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { LibraryItemResponse, ShelfResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';

/**
 * Shelf route showing the books that currently belong to one active shelf.
 */
@Component({
  selector: 'app-shelf',
  imports: [RouterLink],
  templateUrl: './shelf.html',
  styleUrl: './shelf.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shelf {
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly shelvesService = inject(Shelves);

  protected readonly currentShelf = signal<ShelfResponse | null>(null);
  protected readonly items = signal<LibraryItemResponse[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  /**
   * Reloads shelf metadata and contents when the route shelf id changes.
   */
  public constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const shelfId = params.get('id');
      if (shelfId) {
        void this.loadShelf(shelfId);
      }
    });
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
   * Loads all shelves to find the current label and all books for the shelf id.
   */
  private async loadShelf(shelfId: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const [shelves, items] = await Promise.all([
        this.shelvesService.list(),
        this.library.list(shelfId),
      ]);
      this.currentShelf.set(shelves.find((shelf) => shelf.id === shelfId) ?? null);
      this.items.set(items);
    } catch {
      this.error.set('Shelf could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
