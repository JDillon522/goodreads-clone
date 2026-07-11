import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  GoogleBookFilter,
  GoogleBookOrderBy,
  GoogleBookPrintType,
} from '../dto/book-search-query.dto';
import type { JsonObject } from '../types/json-object';

/**
 * Queries public Google Books volume search/detail data and normalizes volume records into the
 * shared Bookshelf book shape.
 */
export type GoogleBooksVolumeCandidate = {
  authors: string[];
  categories: string[];
  description: null | string;
  ebookAccess: null | string;
  id: string;
  infoLink: null | string;
  isbn10: null | string;
  isbn13: null | string;
  isReadableOnline: boolean;
  pageCount: null | number;
  publishedDate: null | string;
  publisher: null | string;
  rawPayload: JsonObject;
  subtitle: null | string;
  thumbnailUrl: null | string;
  title: null | string;
};

export type GoogleBooksSearchRequest = {
  filter?: GoogleBookFilter | null;
  maxResults: number;
  orderBy: GoogleBookOrderBy;
  printType: GoogleBookPrintType;
  query: string;
  startIndex: number;
};

export type GoogleBooksSearchResult = {
  items: GoogleBooksVolumeCandidate[];
  rawPayload: JsonObject;
  totalItems: number;
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
   * Fetches a single Google Books volume by provider id for the info-only detail page.
   */
  public async getVolume(volumeId: string): Promise<GoogleBooksVolumeCandidate | null> {
    const raw = await this.fetchJson(`/volumes/${encodeURIComponent(volumeId)}`);
    return normalizeGoogleVolume(raw);
  }
  /**
   * Searches Google Books using native provider pagination and filter options.
   */
  public async searchVolumes(request: GoogleBooksSearchRequest): Promise<GoogleBooksSearchResult> {
    const url = new URL(`${this.baseUrl}/volumes`);
    url.searchParams.set('q', request.query);
    url.searchParams.set('maxResults', String(request.maxResults));
    url.searchParams.set('startIndex', String(request.startIndex));
    url.searchParams.set('printType', request.printType);
    url.searchParams.set('orderBy', request.orderBy);
    url.searchParams.set('projection', 'full');

    if (request.filter) {
      url.searchParams.set('filter', request.filter);
    }

    const payload = await this.fetchJson(url.toString());
    const items = Array.isArray(payload['items'])
      ? payload['items'].map(normalizeGoogleVolume).filter(isVolumeCandidate)
      : [];

    return {
      items,
      rawPayload: payload,
      totalItems: positiveIntegerValue(payload['totalItems']) ?? items.length,
    };
  }
  /**
   * Fetches JSON from either a configured-relative Google path or a complete URL.
   */
  private async fetchJson(pathOrUrl: string): Promise<JsonObject> {
    const url = pathOrUrl.startsWith('http')
      ? new URL(pathOrUrl)
      : new URL(`${this.baseUrl}${pathOrUrl}`);

    if (this.apiKey && !url.searchParams.has('key')) {
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
      throw new ServiceUnavailableException('Google Books request failed.');
    }

    if (response.status === 404) {
      throw new NotFoundException('Google Books volume was not found.');
    }

    if (response.status === 429) {
      throw new HttpException('Google Books rate limit reached.', 429);
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Google Books returned an unavailable response.');
    }

    const payload: unknown = await response.json();

    if (!isRecord(payload)) {
      throw new ServiceUnavailableException('Google Books returned an invalid response.');
    }

    return payload;
  }
}

/**
 * Narrows one Google Books volume item and extracts the fields Bookshelf can safely merge.
 */
function normalizeGoogleVolume(value: unknown): GoogleBooksVolumeCandidate | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !isRecord(value['volumeInfo'])) {
    return null;
  }

  const volumeInfo = value['volumeInfo'];
  const accessInfo = isRecord(value['accessInfo']) ? value['accessInfo'] : {};
  const identifiers = Array.isArray(volumeInfo['industryIdentifiers'])
    ? volumeInfo['industryIdentifiers']
    : [];
  const imageLinks = isRecord(volumeInfo['imageLinks']) ? volumeInfo['imageLinks'] : {};
  const ebookAccess = readOptionalString(accessInfo['accessViewStatus']);
  const isReadableOnline =
    accessInfo['viewability'] === 'ALL_PAGES' ||
    accessInfo['viewability'] === 'PARTIAL' ||
    accessInfo['publicDomain'] === true ||
    accessInfo['embeddable'] === true;

  return {
    authors: readStringArray(volumeInfo['authors']),
    categories: readStringArray(volumeInfo['categories']),
    description: readOptionalString(volumeInfo['description']),
    ebookAccess,
    id: value['id'],
    infoLink: readHttpsUrl(volumeInfo['infoLink']),
    isbn10: readIdentifier(identifiers, 'ISBN_10'),
    isbn13: readIdentifier(identifiers, 'ISBN_13'),
    isReadableOnline,
    pageCount:
      typeof volumeInfo['pageCount'] === 'number' && volumeInfo['pageCount'] > 0
        ? Math.round(volumeInfo['pageCount'])
        : null,
    publishedDate: readOptionalString(volumeInfo['publishedDate']),
    publisher: readOptionalString(volumeInfo['publisher']),
    rawPayload: value,
    subtitle: readOptionalString(volumeInfo['subtitle']),
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

function isVolumeCandidate(
  value: GoogleBooksVolumeCandidate | null,
): value is GoogleBooksVolumeCandidate {
  return value !== null;
}

function positiveIntegerValue(value: unknown): null | number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
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
