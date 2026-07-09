import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { BookSearchFiltersDto } from './dto/book-search-filters.dto';
import { BookSearchQueryDto } from './dto/book-search-query.dto';
import { BookSearchResponseDto } from './dto/book-search-response.dto';
import { NormalizedBookDto } from './dto/normalized-book.dto';
import type { OpenLibraryDetailKind } from './types/open-library-detail-kind';
import { OpenLibraryCacheService } from './open-library/open-library-cache.service';
import { OpenLibraryClientService } from './open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from './open-library/open-library-normalizer.service';

/**
 * Orchestrates Open Library lookup calls, cache storage, filter query composition, and normalized
 * API responses for book search and detail endpoints.
 */
@Injectable()
export class BooksService {
  private readonly detailCacheTtlHours: number;
  private readonly searchCacheTtlHours: number;
  /**
   * Reads cache TTL settings and receives Open Library collaborators from Nest.
   */
  public constructor(
    configService: ConfigService,
    private readonly cache: OpenLibraryCacheService,
    private readonly openLibraryClient: OpenLibraryClientService,
    private readonly openLibraryNormalizer: OpenLibraryNormalizerService,
  ) {
    this.detailCacheTtlHours =
      configService.get<number>('OPEN_LIBRARY_DETAIL_CACHE_TTL_HOURS') ?? 168;
    this.searchCacheTtlHours =
      configService.get<number>('OPEN_LIBRARY_SEARCH_CACHE_TTL_HOURS') ?? 24;
  }
  /**
   * Returns normalized work or edition detail, using the cached normalized record when available.
   */
  public async getOpenLibraryDetail(
    type: OpenLibraryDetailKind,
    id: string,
  ): Promise<NormalizedBookDto> {
    this.validateOpenLibraryKeyPair(type, id);

    const providerKey = this.detailCacheKey(type, id);
    const cached = await this.cache.getBook(providerKey);

    if (cached) {
      return cached;
    }

    const raw = await this.openLibraryClient.getDetail(type, id);
    const normalized = this.openLibraryNormalizer.normalizeDetail(raw, { id, type });

    await this.cache.set(
      providerKey,
      raw,
      normalized,
      this.dateAfterHours(this.detailCacheTtlHours),
    );

    return normalized;
  }
  /**
   * Searches Open Library with Bookshelf filters, caches by normalized query/filter/page, and returns
   * the user-facing query separately from provider-specific search clauses.
   */
  public async searchBooks(query: BookSearchQueryDto): Promise<BookSearchResponseDto> {
    const normalizedQuery = query.query.trim().replace(/\s+/g, ' ');
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filters = normalizeSearchFilters(query);
    const providerQuery = openLibraryQueryFromFilters(normalizedQuery, filters);
    const providerKey = this.searchCacheKey(normalizedQuery, page, limit, filters);
    const cached = await this.cache.getSearch(providerKey);

    if (cached) {
      return cached;
    }

    const raw = await this.openLibraryClient.searchBooks({
      limit,
      page,
      query: providerQuery,
    });
    const normalized = this.openLibraryNormalizer.normalizeSearch(raw, {
      filters,
      limit,
      page,
      query: normalizedQuery,
    });

    await this.cache.set(
      providerKey,
      raw,
      normalized,
      this.dateAfterHours(this.searchCacheTtlHours),
      normalizedQuery,
    );

    return normalized;
  }
  /**
   * Calculates cache expiration dates from hour-based settings.
   */
  private dateAfterHours(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  /**
   * Builds the stable cache key for one Open Library detail resource.
   */
  private detailCacheKey(type: OpenLibraryDetailKind, id: string): string {
    return `detail:${type}:${id}`;
  }
  /**
   * Hashes search state so filters, pagination, and normalized query text do not collide.
   */
  private searchCacheKey(
    query: string,
    page: number,
    limit: number,
    filters: BookSearchFiltersDto,
  ): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ filters, limit, page, query: query.toLowerCase() }))
      .digest('hex');

    return `search:${hash}`;
  }
  /**
   * Ensures callers do not request work details through edition ids or edition details through work
   * ids.
   */
  private validateOpenLibraryKeyPair(type: OpenLibraryDetailKind, id: string): void {
    if (type === 'works' && !id.endsWith('W')) {
      throw new BadRequestException(
        'Work detail requests require an Open Library work id ending in W.',
      );
    }

    if (type === 'books' && !id.endsWith('M')) {
      throw new BadRequestException(
        'Book detail requests require an Open Library edition id ending in M.',
      );
    }
  }
}
/**
 * Normalizes optional search filters and rejects impossible year ranges before provider calls.
 */
function normalizeSearchFilters(query: BookSearchQueryDto): BookSearchFiltersDto {
  const filters: BookSearchFiltersDto = {
    format: query.format ?? null,
    subject: query.subject?.trim().replace(/\s+/g, ' ') || null,
    yearFrom: query.yearFrom ?? null,
    yearTo: query.yearTo ?? null,
  };

  if (
    typeof filters.yearFrom === 'number' &&
    typeof filters.yearTo === 'number' &&
    filters.yearFrom > filters.yearTo
  ) {
    throw new BadRequestException('yearFrom must be less than or equal to yearTo.');
  }

  return filters;
}
/**
 * Converts Bookshelf filter state into documented Open Library search clauses while preserving the
 * original user query for the response payload.
 */
function openLibraryQueryFromFilters(query: string, filters: BookSearchFiltersDto): string {
  const clauses = [query];

  if (typeof filters.yearFrom === 'number' || typeof filters.yearTo === 'number') {
    clauses.push(`first_publish_year:[${filters.yearFrom ?? '*'} TO ${filters.yearTo ?? '*'}]`);
  }

  if (filters.subject) {
    clauses.push(`subject:${quoteOpenLibraryPhrase(filters.subject)}`);
  }

  if (filters.format === 'ebook') {
    clauses.push('has_fulltext:true');
  }

  return clauses.join(' ');
}
/**
 * Quotes user-entered phrase filters for Open Library search syntax.
 */
function quoteOpenLibraryPhrase(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
