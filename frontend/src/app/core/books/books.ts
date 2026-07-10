import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  BookSearchResponse,
  BookSeriesResponse,
  NormalizedBook,
  RelatedBooksResponse,
} from '../api/api.types';

/**
 * Books API wrapper for Google-first search/detail lookup and shared book relation endpoints.
 *
 * Search accepts frontend filter state and passes it through to the backend,
 * which calls Google Books and returns normalized books plus provider-native controls.
 */
export type BookSearchRequestFilters = {
  filter?: 'ebooks' | 'free-ebooks' | 'full' | 'paid-ebooks';
  orderBy?: 'newest' | 'relevance';
  printType?: 'all' | 'books' | 'magazines';
};

@Injectable({ providedIn: 'root' })
export class Books {
  private readonly api = inject(ApiClient);
  /**
   * Searches Google Books through the backend with pagination and optional filters.
   */
  public search(
    query: string,
    page = 1,
    limit = 10,
    filters: BookSearchRequestFilters = {},
  ): Promise<BookSearchResponse> {
    return this.api.get<BookSearchResponse>('/api/books/search', {
      ...filters,
      query,
      page,
      limit,
    });
  }
  /**
   * Loads a normalized Google Books volume by provider id.
   */
  public googleDetail(id: string): Promise<NormalizedBook> {
    return this.api.get<NormalizedBook>(`/api/books/google/${encodeURIComponent(id)}`);
  }
  /**
   * Loads detected series context for one persisted shared book.
   */
  public series(bookId: string): Promise<BookSeriesResponse> {
    return this.api.get<BookSeriesResponse>(`/api/books/${encodeURIComponent(bookId)}/series`);
  }
  /**
   * Loads related persisted books for one shared book.
   */
  public related(bookId: string, limit = 12): Promise<RelatedBooksResponse> {
    return this.api.get<RelatedBooksResponse>(`/api/books/${encodeURIComponent(bookId)}/related`, {
      limit,
    });
  }
}
