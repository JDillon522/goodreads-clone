import { GoogleBooksSyncStatus } from '@prisma/client';

import { normalizeText } from '../library/library-rules';
import type { BookCardResponseDto } from './dto/book-card-response.dto';
import type {
  BookCoverImagesDto,
  BookMetadataResponseDto,
  BookSummaryDto,
} from './dto/book-metadata-response.dto';
import type { JsonObject } from './types/json-object';

/** Converts Google-backed cache rows into the public Bookshelf metadata contracts. */
export type BookMetadataRecord = {
  googleBooksError: null | string;
  googleBooksRawPayload: JsonObject | null;
  googleBooksSyncStatus: GoogleBooksSyncStatus;
  googleBooksSyncedAt: Date | null;
  googleBooksVolumeId: null | string;
  id: string;
  isbn10: null | string;
  isbn13: null | string;
  normalizedPrimaryAuthor: null | string;
  normalizedTitle: string;
  sourceId: string;
  sourceProvider: string;
  sourceUrl: null | string;
};

type CoverContext = 'card' | 'detail' | 'theme' | 'thumbnail';

/** Builds the shared response used by search, info-only detail, and saved library detail. */
export function toBookMetadataResponse(book: BookMetadataRecord): BookMetadataResponseDto {
  return {
    google: googlePayload(book),
    id: book.id,
    summary: bookSummary(book),
    sync: {
      googleBooksError: book.googleBooksError,
      googleBooksStatus: book.googleBooksSyncStatus,
      googleBooksSyncedAt: book.googleBooksSyncedAt?.toISOString() ?? null,
    },
  };
}

/** Builds the compact card shape from the same computed summary used by detail responses. */
export function toBookCardResponse(book: BookMetadataRecord): BookCardResponseDto {
  const summary = bookSummary(book);

  return {
    authors: summary.authors,
    coverUrl: summary.coverUrl,
    genres: summary.genres,
    googleBooksVolumeId: summary.googleBooksVolumeId,
    id: book.id,
    primaryAuthor: summary.primaryAuthor,
    publishedDate: summary.publishedDate,
    sourceId: book.sourceId,
    sourceProvider: book.sourceProvider,
    sourceUrl: summary.externalLinks.info ?? book.sourceUrl,
    subtitle: summary.subtitle,
    title: summary.title,
  };
}

/** Extracts stable display/search fields from the raw Google Books volume payload. */
export function bookSummary(book: BookMetadataRecord): BookSummaryDto {
  const google = googlePayload(book);
  const volumeInfo = recordValue(google?.['volumeInfo']);
  const saleInfo = recordValue(google?.['saleInfo']);
  const accessInfo = recordValue(google?.['accessInfo']);
  const imageLinks = recordValue(volumeInfo?.['imageLinks']);
  const title =
    stringValue(volumeInfo?.['title']) ??
    humanizeNormalizedText(book.normalizedTitle) ??
    'Untitled book';
  const subtitle = stringValue(volumeInfo?.['subtitle']);
  const authors = cleanStrings(stringArrayValue(volumeInfo?.['authors']));
  const primaryAuthor = authors[0] ?? humanizeNormalizedText(book.normalizedPrimaryAuthor);
  const categories = cleanStrings(stringArrayValue(volumeInfo?.['categories'])).slice(0, 20);
  const isbn13 =
    readIdentifier(volumeInfo?.['industryIdentifiers'], 'ISBN_13') ?? cleanIsbn(book.isbn13);
  const isbn10 =
    readIdentifier(volumeInfo?.['industryIdentifiers'], 'ISBN_10') ?? cleanIsbn(book.isbn10);
  const providerKey = book.googleBooksVolumeId
    ? `google:${book.googleBooksVolumeId}`
    : `google:${book.sourceId}`;
  const coverImages = coverImagesFromRaw(imageLinks);
  const externalLinks = {
    buy: httpsUrl(saleInfo?.['buyLink']),
    canonical: httpsUrl(volumeInfo?.['canonicalVolumeLink']),
    info: httpsUrl(volumeInfo?.['infoLink']) ?? book.sourceUrl,
    preview: httpsUrl(volumeInfo?.['previewLink']),
    webReader: httpsUrl(accessInfo?.['webReaderLink']),
  };

  return {
    authors,
    averageRating: numberValue(volumeInfo?.['averageRating']),
    categories,
    coverImages,
    coverUrl: coverImages.card,
    dedupeKey: dedupeKeyForSummary(isbn13, isbn10, providerKey, title, primaryAuthor),
    description: stringValue(volumeInfo?.['description']),
    ebookAccess: stringValue(accessInfo?.['accessViewStatus']),
    externalLinks,
    genres: categories,
    googleBooksVolumeId: book.googleBooksVolumeId,
    isbn10,
    isbn13,
    isReadableOnline: isReadableOnline(accessInfo),
    language: stringValue(volumeInfo?.['language']),
    pageCount: positiveIntegerValue(volumeInfo?.['pageCount']),
    primaryAuthor,
    printType: stringValue(volumeInfo?.['printType']),
    providerKey,
    publishedDate: stringValue(volumeInfo?.['publishedDate']),
    publisher: stringValue(volumeInfo?.['publisher']),
    ratingsCount: positiveIntegerValue(volumeInfo?.['ratingsCount']),
    subtitle,
    title,
  };
}

/** Chooses the best Google Books cover URL for a display context. */
export function selectBookCover(book: BookMetadataRecord, context: CoverContext): null | string {
  return bookSummary(book).coverImages[context];
}

function cleanIsbn(value: null | string | undefined): null | string {
  const cleaned = value?.replace(/[-\s]/g, '').toUpperCase() ?? '';
  return cleaned || null;
}

function cleanStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const normalized = normalizeText(trimmed);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}

function coverImagesFromRaw(imageLinks: JsonObject | null): BookCoverImagesDto {
  const extraLarge = imageUrl(imageLinks?.['extraLarge']);
  const large = imageUrl(imageLinks?.['large']);
  const medium = imageUrl(imageLinks?.['medium']);
  const small = imageUrl(imageLinks?.['small']);
  const thumbnail = imageUrl(imageLinks?.['thumbnail']);
  const smallThumbnail = imageUrl(imageLinks?.['smallThumbnail']);
  const highResolution = extraLarge ?? large ?? medium ?? small ?? thumbnail ?? smallThumbnail;
  const card = thumbnail ?? small ?? smallThumbnail ?? highResolution;

  return {
    card,
    detail: highResolution,
    theme: highResolution,
    thumbnail: smallThumbnail ?? card,
  };
}

function dedupeKeyForSummary(
  isbn13: null | string,
  isbn10: null | string,
  providerKey: string,
  title: string,
  primaryAuthor: null | string,
): string {
  if (isbn13) {
    return `isbn13:${isbn13}`;
  }

  if (isbn10) {
    return `isbn10:${isbn10}`;
  }

  return `${providerKey}:${normalizeText(title)}:${normalizeText(primaryAuthor ?? 'unknown')}`;
}

function googlePayload(book: BookMetadataRecord): JsonObject | null {
  return isRecord(book.googleBooksRawPayload) ? book.googleBooksRawPayload : null;
}

function humanizeNormalizedText(value: null | string): null | string {
  if (!value) {
    return null;
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function imageUrl(value: unknown): null | string {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/^http:\/\//i, 'https://').trim();
  return normalized.startsWith('https://') ? normalized : null;
}

function isReadableOnline(accessInfo: JsonObject | null): boolean {
  return (
    accessInfo?.['viewability'] === 'ALL_PAGES' ||
    accessInfo?.['viewability'] === 'PARTIAL' ||
    accessInfo?.['publicDomain'] === true ||
    accessInfo?.['embeddable'] === true ||
    recordValue(accessInfo?.['epub'])?.['isAvailable'] === true ||
    recordValue(accessInfo?.['pdf'])?.['isAvailable'] === true
  );
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): null | number {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveIntegerValue(value: unknown): null | number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function readIdentifier(value: unknown, type: 'ISBN_10' | 'ISBN_13'): null | string {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const candidate of value) {
    if (
      isRecord(candidate) &&
      candidate['type'] === type &&
      typeof candidate['identifier'] === 'string'
    ) {
      return cleanIsbn(candidate['identifier']);
    }
  }

  return null;
}

function recordValue(value: unknown): JsonObject | null {
  return isRecord(value) ? value : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringValue(value: unknown): null | string {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function httpsUrl(value: unknown): null | string {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/^http:\/\//i, 'https://').trim();
  return normalized.startsWith('https://') ? normalized : null;
}
