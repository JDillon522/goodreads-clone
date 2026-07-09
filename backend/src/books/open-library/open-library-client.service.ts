import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { JsonObject } from '../types/json-object';
import type { OpenLibraryDetailKind } from '../types/open-library-detail-kind';

/**
 * Thin HTTP client for Open Library. It owns provider URLs, request headers, requested search
 * fields, timeout behavior, and translation of provider failures into API exceptions.
 */
type SearchRequest = {
  limit: number;
  page: number;
  query: string;
};

@Injectable()
export class OpenLibraryClientService {
  private readonly logger = new Logger(OpenLibraryClientService.name);
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly userAgent: string;
  /**
   * Reads provider endpoint, timeout, and user-agent settings from validated config.
   */
  public constructor(configService: ConfigService) {
    this.baseUrl = trimTrailingSlash(
      configService.get<string>('OPEN_LIBRARY_BASE_URL') ?? 'https://openlibrary.org',
    );
    this.userAgent =
      configService.get<string>('OPEN_LIBRARY_USER_AGENT') ??
      'Bookshelf/0.1.0 (local development; contact: local@example.com)';
    this.requestTimeoutMs = configService.get<number>('OPEN_LIBRARY_REQUEST_TIMEOUT_MS') ?? 8000;
  }
  /**
   * Fetches one Open Library work or edition JSON document.
   */
  public async getDetail(type: OpenLibraryDetailKind, id: string): Promise<JsonObject> {
    return this.fetchJson(`/${type}/${id}.json`);
  }
  /**
   * Searches Open Library with the fields needed for card rendering, filters, and dynamic facets.
   */
  public async searchBooks(request: SearchRequest): Promise<JsonObject> {
    const url = new URL(`${this.baseUrl}/search.json`);
    url.searchParams.set('q', request.query);
    url.searchParams.set('page', String(request.page));
    url.searchParams.set('limit', String(request.limit));
    url.searchParams.set(
      'fields',
      [
        'key',
        'title',
        'subtitle',
        'author_name',
        'first_publish_year',
        'cover_i',
        'edition_key',
        'isbn',
        'number_of_pages_median',
        'edition_count',
        'subject',
        'publisher',
        'has_fulltext',
        'public_scan_b',
        'ebook_access',
        'editions',
        'editions.ebook_access',
        'editions.title',
      ].join(','),
    );

    return this.fetchJson(url.toString());
  }
  /**
   * Fetches JSON and maps known provider/network failures to stable HTTP exceptions.
   */
  private async fetchJson(pathOrUrl: string): Promise<JsonObject> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      this.logger.warn(`Open Library request failed: ${describeFetchFailure(error)}`);
      throw new ServiceUnavailableException('Open Library request failed.');
    }

    if (response.status === 404) {
      throw new NotFoundException('Open Library book was not found.');
    }

    if (response.status === 429) {
      throw new HttpException('Open Library rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Open Library returned an unavailable response.');
    }

    const payload: unknown = await response.json();

    if (!isJsonObject(payload)) {
      throw new ServiceUnavailableException('Open Library returned an invalid response.');
    }

    return payload;
  }
}
/**
 * Narrows provider responses to top-level JSON objects.
 */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Normalizes configured base URLs so path joins are predictable.
 */
function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
/**
 * Extracts useful network failure details for server logs without exposing them to API clients.
 */
function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown fetch failure';
  }

  const cause = error.cause;
  const causeMessage =
    cause instanceof Error
      ? `${cause.message}${'code' in cause && typeof cause.code === 'string' ? ` (${cause.code})` : ''}`
      : undefined;

  return causeMessage ? `${error.message}; cause: ${causeMessage}` : error.message;
}
