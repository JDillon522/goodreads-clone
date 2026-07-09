import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { BookSearchResponse, NormalizedBook } from '../api/api.types';

/**
 * Books API wrapper for Open Library-backed search and detail lookup.
 *
 * Search accepts frontend filter state and passes it through to the backend,
 * which composes the Open Library query and returns normalized books plus facets.
 */
type OpenLibraryDetailType = 'books' | 'works';
export type BookSearchRequestFilters = {
  format?: 'ebook';
  subject?: string;
  yearFrom?: number;
  yearTo?: number;
};

@Injectable({ providedIn: 'root' })
export class Books {
  private readonly api = inject(ApiClient);
  /**
   * Searches Open Library through the backend with pagination and optional filters.
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
   * Loads a normalized Open Library work or edition by provider id.
   */
  public detail(type: OpenLibraryDetailType, id: string): Promise<NormalizedBook> {
    return this.api.get<NormalizedBook>(
      `/api/books/open-library/${type}/${encodeURIComponent(id)}`,
    );
  }
}
