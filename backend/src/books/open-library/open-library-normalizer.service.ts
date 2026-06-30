import { Injectable } from '@nestjs/common';

import { BookSearchResponseDto } from '../dto/book-search-response.dto';
import { NormalizedBookDto } from '../dto/normalized-book.dto';
import type { JsonObject } from '../types/json-object';
import type { OpenLibraryDetailKind } from '../types/open-library-detail-kind';

const openLibraryWebBaseUrl = 'https://openlibrary.org';
const openLibraryCoverBaseUrl = 'https://covers.openlibrary.org';
const maxGenres = 12;

type SearchOptions = {
  limit: number;
  page: number;
  query: string;
};

type DetailOptions = {
  id: string;
  type: OpenLibraryDetailKind;
};

@Injectable()
export class OpenLibraryNormalizerService {
  public normalizeDetail(raw: JsonObject, options: DetailOptions): NormalizedBookDto {
    const fallbackKey = `/${options.type}/${options.id}`;
    const rawKey = stringValue(raw.key) ?? fallbackKey;
    const editionKey =
      options.type === 'books' ? (normalizeOpenLibraryKey(rawKey, 'books') ?? fallbackKey) : null;
    const workKey =
      options.type === 'works'
        ? (normalizeOpenLibraryKey(rawKey, 'works') ?? fallbackKey)
        : this.firstWorkKey(raw);
    const title = stringValue(raw.title) ?? 'Untitled book';
    const subtitle = stringValue(raw.subtitle);
    const authors = this.extractDetailAuthors(raw);
    const primaryAuthor = authors[0] ?? null;
    const isbn10 = firstIsbn(stringArrayValue(raw.isbn_10), 10);
    const isbn13 = firstIsbn(stringArrayValue(raw.isbn_13), 13);
    const providerKey = providerKeyFromKeys(workKey, editionKey, title, primaryAuthor);

    return {
      authors,
      coverUrl: coverUrlFromCoverIds(numberArrayValue(raw.covers)),
      dedupeKey: dedupeKeyForBook(isbn13, isbn10, providerKey, title, primaryAuthor),
      description: descriptionValue(raw.description),
      genres: uniqueStrings([
        ...stringArrayValue(raw.subjects),
        ...stringArrayValue(raw.subject_places),
        ...stringArrayValue(raw.subject_people),
        ...stringArrayValue(raw.subject_times),
      ]).slice(0, maxGenres),
      isbn10,
      isbn13,
      openLibraryEditionKey: editionKey,
      openLibraryWorkKey: workKey,
      pageCount: positiveIntegerValue(raw.number_of_pages),
      primaryAuthor,
      provider: 'OPEN_LIBRARY',
      providerKey,
      publishedDate: stringValue(raw.publish_date) ?? stringValue(raw.first_publish_date),
      publisher: firstString(stringArrayValue(raw.publishers)),
      sourceId: providerKey,
      sourceUrl: sourceUrlFromKeys(workKey, editionKey),
      subtitle,
      title,
    };
  }

  public normalizeSearch(raw: JsonObject, options: SearchOptions): BookSearchResponseDto {
    const docs = objectArrayValue(raw.docs);
    const items = dedupeSearchResults(docs.map((doc) => this.normalizeSearchDoc(doc)));

    return {
      count: items.length,
      items,
      limit: options.limit,
      page: options.page,
      query: options.query,
      total: positiveIntegerValue(raw.numFound) ?? items.length,
    };
  }

  private extractDetailAuthors(raw: JsonObject): string[] {
    return uniqueStrings(
      objectArrayValue(raw.authors)
        .map((authorRef) => {
          const nestedAuthor = objectValue(authorRef.author);
          return (
            stringValue(authorRef.name) ??
            stringValue(authorRef.fullname) ??
            stringValue(nestedAuthor?.name) ??
            stringValue(nestedAuthor?.fullname)
          );
        })
        .filter(isString),
    );
  }

  private firstWorkKey(raw: JsonObject): null | string {
    const work = objectArrayValue(raw.works)[0];
    return work ? normalizeOpenLibraryKey(stringValue(work.key), 'works') : null;
  }

  private normalizeSearchDoc(doc: JsonObject): NormalizedBookDto {
    const title = stringValue(doc.title) ?? 'Untitled book';
    const authors = uniqueStrings(stringArrayValue(doc.author_name));
    const primaryAuthor = authors[0] ?? null;
    const workKey = normalizeOpenLibraryKey(stringValue(doc.key), 'works');
    const editionKey = firstString(stringArrayValue(doc.edition_key))
      ? `/books/${firstString(stringArrayValue(doc.edition_key))}`
      : null;
    const isbn10 = firstIsbn(stringArrayValue(doc.isbn), 10);
    const isbn13 = firstIsbn(stringArrayValue(doc.isbn), 13);
    const providerKey = providerKeyFromKeys(workKey, editionKey, title, primaryAuthor);

    return {
      authors,
      coverUrl: coverUrlFromCoverId(positiveIntegerValue(doc.cover_i)),
      dedupeKey: dedupeKeyForBook(isbn13, isbn10, providerKey, title, primaryAuthor),
      description: null,
      genres: uniqueStrings(stringArrayValue(doc.subject)).slice(0, maxGenres),
      isbn10,
      isbn13,
      openLibraryEditionKey: editionKey,
      openLibraryWorkKey: workKey,
      pageCount: positiveIntegerValue(doc.number_of_pages_median),
      primaryAuthor,
      provider: 'OPEN_LIBRARY',
      providerKey,
      publishedDate: numberOrStringAsString(doc.first_publish_year),
      publisher: firstString(stringArrayValue(doc.publisher)),
      sourceId: providerKey,
      sourceUrl: sourceUrlFromKeys(workKey, editionKey),
      subtitle: stringValue(doc.subtitle),
      title,
    };
  }
}

function coverUrlFromCoverId(coverId: null | number): null | string {
  return coverId ? `${openLibraryCoverBaseUrl}/b/id/${coverId}-L.jpg` : null;
}

function coverUrlFromCoverIds(coverIds: number[]): null | string {
  return coverUrlFromCoverId(coverIds.find((coverId) => coverId > 0) ?? null);
}

function dedupeKeyForBook(
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

  if (providerKey.startsWith('works:') || providerKey.startsWith('books:')) {
    return `open-library:${providerKey}`;
  }

  return `title-author:${normalizeText(title)}:${normalizeText(primaryAuthor ?? 'unknown')}`;
}

function dedupeSearchResults(items: NormalizedBookDto[]): NormalizedBookDto[] {
  const bestByKey = new Map<string, NormalizedBookDto>();

  for (const item of items) {
    const key =
      item.openLibraryWorkKey ??
      item.openLibraryEditionKey ??
      `title-author:${normalizeText(item.title)}:${normalizeText(item.primaryAuthor ?? 'unknown')}`;
    const existing = bestByKey.get(key);

    if (!existing || scoreBookResult(item) > scoreBookResult(existing)) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()];
}

function descriptionValue(value: unknown): null | string {
  if (isString(value)) {
    return normalizeWhitespace(value);
  }

  const descriptionObject = objectValue(value);
  const description = descriptionObject ? stringValue(descriptionObject.value) : null;

  return description ? normalizeWhitespace(description) : null;
}

function firstIsbn(values: string[], length: 10 | 13): null | string {
  return (
    values
      .map((value) => value.replace(/[-\s]/g, '').toUpperCase())
      .find((value) => (length === 10 ? /^\d{9}[\dX]$/.test(value) : /^\d{13}$/.test(value))) ??
    null
  );
}

function firstString(values: string[]): null | string {
  return values[0] ?? null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOpenLibraryKey(
  value: null | string | undefined,
  type: OpenLibraryDetailKind,
): null | string {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const bareIdMatch = /^OL\d+[MW]$/.exec(trimmed);

  if (bareIdMatch) {
    return `/${type}/${trimmed}`;
  }

  const keyMatch = new RegExp(`^/${type}/(OL\\d+[MW])$`).exec(trimmed);

  return keyMatch ? `/${type}/${keyMatch[1]}` : null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function numberArrayValue(value: unknown): number[] {
  return Array.isArray(value) ? value.map(positiveIntegerValue).filter(isNumber) : [];
}

function numberOrStringAsString(value: unknown): null | string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return stringValue(value);
}

function objectArrayValue(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(objectValue).filter(isObject) : [];
}

function objectValue(value: unknown): JsonObject | null {
  return isObject(value) ? value : null;
}

function positiveIntegerValue(value: unknown): null | number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function providerKeyFromKeys(
  workKey: null | string,
  editionKey: null | string,
  title: string,
  primaryAuthor: null | string,
): string {
  if (workKey) {
    return `works:${workKey.split('/').at(-1)}`;
  }

  if (editionKey) {
    return `books:${editionKey.split('/').at(-1)}`;
  }

  return `title-author:${normalizeText(title)}:${normalizeText(primaryAuthor ?? 'unknown')}`;
}

function scoreBookResult(item: NormalizedBookDto): number {
  return [
    item.isbn13 ? 13 : 0,
    item.isbn10 ? 10 : 0,
    item.coverUrl ? 8 : 0,
    item.pageCount ? 5 : 0,
    item.primaryAuthor ? 3 : 0,
    item.openLibraryEditionKey ? 2 : 0,
  ].reduce((score, value) => score + value, 0);
}

function sourceUrlFromKeys(workKey: null | string, editionKey: null | string): null | string {
  const key = workKey ?? editionKey;
  return key ? `${openLibraryWebBaseUrl}${key}` : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString).map(normalizeWhitespace) : [];
}

function stringValue(value: unknown): null | string {
  return isString(value) ? normalizeWhitespace(value) : null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isNumber(value: null | number): value is number {
  return typeof value === 'number';
}

function isObject(value: JsonObject | null): value is JsonObject;
function isObject(value: unknown): value is JsonObject;
function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
