import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LibraryItemResponse } from '../../core/api/api.types';

/** Paginated library table with one expandable, thumbnail-free book overview at a time. */
@Component({
  selector: 'app-library-table',
  imports: [RouterLink],
  templateUrl: './library-table.html',
  styleUrl: './library-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryTable {
  public readonly items = input.required<LibraryItemResponse[]>();
  public readonly page = input.required<number>();
  public readonly totalPages = input.required<number>();
  public readonly rangeStart = input.required<number>();
  public readonly rangeEnd = input.required<number>();
  public readonly expandedItemId = input<null | string>(null);
  public readonly itemToggled = output<string>();
  public readonly pageChanged = output<number>();

  protected coverUrl(item: LibraryItemResponse): string | null {
    return (
      item.book.summary.coverImages.detail ??
      item.book.summary.coverImages.card ??
      item.book.summary.coverUrl ??
      null
    );
  }

  protected primaryAuthor(item: LibraryItemResponse): string {
    return item.book.summary.primaryAuthor ?? item.book.summary.authors[0] ?? 'Unknown author';
  }

  protected progressLabel(item: LibraryItemResponse): string {
    if (typeof item.currentPage === 'number') {
      return `${item.currentPage} pages`;
    }

    return typeof item.currentPercent === 'number' ? `${item.currentPercent}%` : 'No progress yet';
  }

  protected shelfLabel(item: LibraryItemResponse): string {
    return item.shelves.map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }

  protected statusLabel(item: LibraryItemResponse): string {
    return item.status === 'READ'
      ? 'Read'
      : item.status === 'READING'
        ? 'Currently reading'
        : 'Want to read';
  }

  protected description(item: LibraryItemResponse): string {
    return item.book.summary.description ?? 'No description is available for this edition.';
  }

  protected isbnLabel(item: LibraryItemResponse): string {
    return item.book.summary.isbn13 ?? item.book.summary.isbn10 ?? 'Missing';
  }

  protected dateAddedLabel(item: LibraryItemResponse): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(item.dateAdded),
    );
  }
}
