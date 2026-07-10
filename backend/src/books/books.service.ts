import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { BookPersistenceService } from './book-persistence.service';
import { BookSearchFacetsDto } from './dto/book-search-facets.dto';
import { BookSearchFiltersDto } from './dto/book-search-filters.dto';
import {
  BookSearchQueryDto,
  GoogleBookFilter,
  GoogleBookOrderBy,
  GoogleBookPrintType,
} from './dto/book-search-query.dto';
import { BookSearchResponseDto } from './dto/book-search-response.dto';
import { BookMetadataResponseDto } from './dto/book-metadata-response.dto';
import { GoogleBooksClientService } from './google-books/google-books-client.service';

/**
 * Orchestrates Google Books search/detail requests and stores returned metadata in the shared cache
 * before responding to the frontend.
 */
@Injectable()
export class BooksService {
  /**
   * Receives the primary Google client and shared book cache service from Nest.
   */
  public constructor(
    private readonly bookPersistence: BookPersistenceService,
    private readonly googleBooksClient: GoogleBooksClientService,
  ) {}
  /**
   * Fetches one Google Books volume by id and returns the enriched cached book shape.
   */
  public async getGoogleBookDetail(volumeId: string): Promise<BookMetadataResponseDto> {
    const id = volumeId.trim();

    if (!id) {
      throw new BadRequestException('Google Books volume id is required.');
    }

    const book = await this.bookPersistence.getOrSyncGoogleVolume(id);

    if (!book) {
      throw new NotFoundException('Google Books volume was not found.');
    }

    return this.bookPersistence.toBookMetadata(book);
  }
  /**
   * Searches Google Books with native pagination/filter settings and persists returned volumes.
   */
  public async searchBooks(query: BookSearchQueryDto): Promise<BookSearchResponseDto> {
    const normalizedQuery = query.query.trim().replace(/\s+/g, ' ');
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filters = normalizeSearchFilters(query);
    const search = await this.googleBooksClient.searchVolumes({
      filter: filters.filter,
      maxResults: limit,
      orderBy: filters.orderBy,
      printType: filters.printType,
      query: normalizedQuery,
      startIndex: (page - 1) * limit,
    });
    const cachedBooks = await this.bookPersistence.persistGoogleBooksVolumes(search.items);

    return {
      count: cachedBooks.length,
      facets: googleSearchFacets(search.totalItems),
      filters,
      items: cachedBooks.map((book) => this.bookPersistence.toBookMetadata(book)),
      limit,
      page,
      query: normalizedQuery,
      total: search.totalItems,
    };
  }
}

/**
 * Normalizes optional Google Books query controls to stable response defaults.
 */
function normalizeSearchFilters(query: BookSearchQueryDto): BookSearchFiltersDto {
  return {
    filter: query.filter ?? null,
    orderBy: query.orderBy ?? 'relevance',
    printType: query.printType ?? 'books',
  };
}

/**
 * Returns provider-native control options. Counts reflect the current provider result total because
 * Google Books does not expose per-filter facet counts in the volume list response.
 */
function googleSearchFacets(total: number): BookSearchFacetsDto {
  const count = Math.max(0, total);

  return {
    availability: [
      { count, label: 'All availability', value: 'all' },
      { count, label: 'eBooks', value: 'ebooks' satisfies GoogleBookFilter },
      { count, label: 'Free eBooks', value: 'free-ebooks' satisfies GoogleBookFilter },
      { count, label: 'Full view', value: 'full' satisfies GoogleBookFilter },
      { count, label: 'Paid eBooks', value: 'paid-ebooks' satisfies GoogleBookFilter },
    ],
    printTypes: [
      { count, label: 'Books', value: 'books' satisfies GoogleBookPrintType },
      { count, label: 'Magazines', value: 'magazines' satisfies GoogleBookPrintType },
      { count, label: 'All print types', value: 'all' satisfies GoogleBookPrintType },
    ],
    sortOptions: [
      { count, label: 'Relevance', value: 'relevance' satisfies GoogleBookOrderBy },
      { count, label: 'Newest', value: 'newest' satisfies GoogleBookOrderBy },
    ],
  };
}
