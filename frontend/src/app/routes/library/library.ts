import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';

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

  public constructor() {
    void this.loadLibrary();
  }

  protected coverUrl(item: LibraryItemResponse): string | null {
    return typeof item.book.coverUrl === 'string' ? item.book.coverUrl : null;
  }

  protected primaryAuthor(item: LibraryItemResponse): string {
    return typeof item.book.primaryAuthor === 'string' ? item.book.primaryAuthor : item.book.authors[0] ?? 'Unknown author';
  }

  protected progressLabel(item: LibraryItemResponse): string {
    if (typeof item.currentPage === 'number') {
      return `${item.currentPage} pages`;
    }

    if (typeof item.currentPercent === 'number') {
      return `${item.currentPercent}%`;
    }

    return 'No progress yet';
  }

  protected shelfLabel(item: LibraryItemResponse): string {
    return item.shelves.map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }

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
