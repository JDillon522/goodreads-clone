import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';

import type { NormalizedBook } from '../../core/api/api.types';
import { Books } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';

@Component({
  selector: 'app-search',
  imports: [FormField],
  templateUrl: './search.html',
  styleUrl: './search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  private readonly books = inject(Books);
  private readonly library = inject(LibraryService);
  private readonly model = signal({ query: '' });

  protected readonly results = signal<NormalizedBook[]>([]);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly addingKey = signal<string | null>(null);
  protected readonly searchForm = form(this.model, (path) => {
    required(path.query, { message: 'Search terms are required.' });
    minLength(path.query, 2, { message: 'Use at least 2 characters.' });
  });

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

  protected async addBook(book: NormalizedBook): Promise<void> {
    this.error.set(null);
    this.status.set(null);
    this.addingKey.set(book.providerKey);

    try {
      await this.library.add({ book });
      this.status.set(`${book.title} was added to your library.`);
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
}
