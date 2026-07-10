import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { NormalizedBookDto } from '../dto/normalized-book.dto';
import type { JsonObject } from '../types/json-object';

/**
 * Queries public Google Books volume search data to enrich Bookshelf's app-owned Book rows.
 */
export type GoogleBooksVolumeCandidate = {
  authors: string[];
  categories: string[];
  description: null | string;
  id: string;
  isbn10: null | string;
  isbn13: null | string;
  pageCount: null | number;
  publishedDate: null | string;
  publisher: null | string;
  rawPayload: JsonObject;
  thumbnailUrl: null | string;
  title: null | string;
};

@Injectable()
export class GoogleBooksClientService {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly logger = new Logger(GoogleBooksClientService.name);
  private readonly requestTimeoutMs: number;
  /**
   * Reads Google Books endpoint settings from validated config.
   */
  public constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('GOOGLE_BOOKS_API_KEY')?.trim() || null;
    this.baseUrl = trimTrailingSlash(
      configService.get<string>('GOOGLE_BOOKS_BASE_URL') ?? 'https://www.googleapis.com/books/v1',
    );
    this.requestTimeoutMs = configService.get<number>('GOOGLE_BOOKS_REQUEST_TIMEOUT_MS') ?? 8000;
  }
  /**
   * Finds the strongest Google Books volume candidate for one Open Library-normalized book.
   */
  public async findBestVolume(
    book: Pick<NormalizedBookDto, 'isbn10' | 'isbn13' | 'primaryAuthor' | 'title'>,
  ): Promise<GoogleBooksVolumeCandidate | null> {
    const queries = googleQueriesForBook(book);

    for (const query of queries) {
      const volume = await this.searchFirstVolume(query);

      if (volume) {
        return volume;
      }
    }

    return null;
  }
  /**
   * Searches Google Books and normalizes the first volume result that has usable volumeInfo data.
   */
  private async searchFirstVolume(query: string): Promise<GoogleBooksVolumeCandidate | null> {
    const url = new URL(`${this.baseUrl}/volumes`);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('printType', 'books');
    url.searchParams.set('projection', 'full');

    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      this.logger.warn(`Google Books request failed: ${describeFetchFailure(error)}`);
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Google Books returned ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload['items'])) {
      return null;
    }

    for (const item of payload['items']) {
      const candidate = normalizeGoogleVolume(item);

      if (candidate) {
        return candidate;
      }
    }

    return null;
  }
}

/**
 * Builds high-confidence ISBN queries before falling back to a title/author query.
 */
function googleQueriesForBook(
  book: Pick<NormalizedBookDto, 'isbn10' | 'isbn13' | 'primaryAuthor' | 'title'>,
): string[] {
  const queries = new Set<string>();

  if (book.isbn13) {
    queries.add(`isbn:${book.isbn13}`);
  }

  if (book.isbn10) {
    queries.add(`isbn:${book.isbn10}`);
  }

  const title = book.title.trim();
  const author = book.primaryAuthor?.trim();

  if (title && author) {
    queries.add(`intitle:${title} inauthor:${author}`);
  } else if (title) {
    queries.add(`intitle:${title}`);
  }

  return [...queries];
}

/**
 * Narrows one Google Books volume item and extracts the fields Bookshelf can safely merge.
 */
function normalizeGoogleVolume(value: unknown): GoogleBooksVolumeCandidate | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !isRecord(value['volumeInfo'])) {
    return null;
  }

  const volumeInfo = value['volumeInfo'];
  const identifiers = Array.isArray(volumeInfo['industryIdentifiers'])
    ? volumeInfo['industryIdentifiers']
    : [];
  const imageLinks = isRecord(volumeInfo['imageLinks']) ? volumeInfo['imageLinks'] : {};

  return {
    authors: readStringArray(volumeInfo['authors']),
    categories: readStringArray(volumeInfo['categories']),
    description: readOptionalString(volumeInfo['description']),
    id: value['id'],
    isbn10: readIdentifier(identifiers, 'ISBN_10'),
    isbn13: readIdentifier(identifiers, 'ISBN_13'),
    pageCount:
      typeof volumeInfo['pageCount'] === 'number' && volumeInfo['pageCount'] > 0
        ? Math.round(volumeInfo['pageCount'])
        : null,
    publishedDate: readOptionalString(volumeInfo['publishedDate']),
    publisher: readOptionalString(volumeInfo['publisher']),
    rawPayload: value,
    thumbnailUrl: readHttpsUrl(imageLinks['thumbnail'] ?? imageLinks['smallThumbnail']),
    title: readOptionalString(volumeInfo['title']),
  };
}

function describeFetchFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown fetch failure';
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readHttpsUrl(value: unknown): null | string {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/^http:\/\//i, 'https://').trim();

  return normalized.startsWith('https://') ? normalized : null;
}

function readIdentifier(values: unknown[], type: 'ISBN_10' | 'ISBN_13'): null | string {
  for (const value of values) {
    if (
      isRecord(value) &&
      value['type'] === type &&
      typeof value['identifier'] === 'string' &&
      value['identifier'].trim()
    ) {
      return value['identifier'].trim();
    }
  }

  return null;
}

function readOptionalString(value: unknown): null | string {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
