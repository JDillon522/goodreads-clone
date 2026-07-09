import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type { BookSearchResponse, NormalizedBook } from '../api/api.types';

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

  public detail(type: OpenLibraryDetailType, id: string): Promise<NormalizedBook> {
    return this.api.get<NormalizedBook>(`/api/books/open-library/${type}/${encodeURIComponent(id)}`);
  }
}
