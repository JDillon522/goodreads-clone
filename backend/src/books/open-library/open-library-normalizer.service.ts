import { Injectable } from '@nestjs/common';

import { BookSearchFacetsDto } from '../dto/book-search-facets.dto';
import { BookSearchFiltersDto } from '../dto/book-search-filters.dto';
import { BookSearchResponseDto } from '../dto/book-search-response.dto';
import { NormalizedBookDto } from '../dto/normalized-book.dto';
import type { JsonObject } from '../types/json-object';
import type { OpenLibraryDetailKind } from '../types/open-library-detail-kind';

/**
 * Converts Open Library's inconsistent search/detail payloads into the stable book shape used by
 * Bookshelf. The helpers in this file deliberately tolerate missing or oddly shaped fields because
 * Open Library responses vary across works, editions, and search results.
 */
const openLibraryWebBaseUrl = 'https://openlibrary.org';
const openLibraryCoverBaseUrl = 'https://covers.openlibrary.org';
const maxGenres = 12;
const maxSubjectFacets = 10;

type SearchOptions = {
  filters: BookSearchFiltersDto;
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
  /**
   * Normalizes an Open Library work or edition detail response into the API book contract.
   */
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
    const ebookAccess = ebookAccessValue(raw);
    const isReadableOnline = readableOnlineValue(raw, title, subtitle, ebookAccess);

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
      ebookAccess,
      isReadableOnline,
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
  /**
   * Normalizes a search response, deduplicates equivalent records, and derives response facets
   * from the returned page of results.
   */
  public normalizeSearch(raw: JsonObject, options: SearchOptions): BookSearchResponseDto {
    const docs = objectArrayValue(raw.docs);
    const items = dedupeSearchResults(docs.map((doc) => this.normalizeSearchDoc(doc)));

    return {
      count: items.length,
      facets: facetsFromItems(items),
      filters: options.filters,
      items,
      limit: options.limit,
      page: options.page,
      query: options.query,
      total: positiveIntegerValue(raw.numFound) ?? items.length,
    };
  }
  /**
   * Extracts author names from both edition-style inline names and work-style nested references.
   */
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
  /**
   * Returns the first normalized work key attached to an edition detail response.
   */
  private firstWorkKey(raw: JsonObject): null | string {
    const work = objectArrayValue(raw.works)[0];
    return work ? normalizeOpenLibraryKey(stringValue(work.key), 'works') : null;
  }
  /**
   * Normalizes a single Open Library search document into a candidate book record.
   */
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
    const subtitle = stringValue(doc.subtitle);
    const ebookAccess = ebookAccessValue(doc);
    const isReadableOnline = readableOnlineValue(doc, title, subtitle, ebookAccess);

    return {
      authors,
      coverUrl: coverUrlFromCoverId(positiveIntegerValue(doc.cover_i)),
      dedupeKey: dedupeKeyForBook(isbn13, isbn10, providerKey, title, primaryAuthor),
      description: null,
      genres: uniqueStrings(stringArrayValue(doc.subject)).slice(0, maxGenres),
      isbn10,
      isbn13,
      ebookAccess,
      isReadableOnline,
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
      subtitle,
      title,
    };
  }
}
/**
 * Builds dynamic search facet options from the normalized items in the current response page.
 */
function facetsFromItems(items: NormalizedBookDto[]): BookSearchFacetsDto {
  const decadeCounts = new Map<number, number>();
  const subjectCounts = new Map<string, number>();
  let readableCount = 0;

  for (const item of items) {
    const year = yearFromPublishedDate(item.publishedDate);

    if (year !== null) {
      const decade = Math.floor(year / 10) * 10;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
    }

    for (const subject of item.genres) {
      subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + 1);
    }

    if (item.isReadableOnline) {
      readableCount += 1;
    }
  }

  return {
    formats: [
      {
        count: readableCount,
        label: 'Readable online / eBook',
        value: 'ebook',
      },
    ],
    publishedDecades: [...decadeCounts.entries()]
      .sort(([left], [right]) => right - left)
      .map(([decade, count]) => ({
        count,
        label: `${decade}s`,
        value: `${decade}s`,
        yearFrom: decade,
        yearTo: decade + 9,
      })),
    subjects: [...subjectCounts.entries()]
      .sort(([leftSubject, leftCount], [rightSubject, rightCount]) => {
        if (leftCount !== rightCount) {
          return rightCount - leftCount;
        }

        return leftSubject.localeCompare(rightSubject);
      })
      .slice(0, maxSubjectFacets)
      .map(([subject, count]) => ({
        count,
        label: subject,
        value: subject,
      })),
  };
}
/**
 * Builds the canonical Open Library large-cover URL for a valid cover id.
 */
function coverUrlFromCoverId(coverId: null | number): null | string {
  return coverId ? `${openLibraryCoverBaseUrl}/b/id/${coverId}-L.jpg` : null;
}
/**
 * Picks the first usable cover id from detail responses that can include multiple covers.
 */
function coverUrlFromCoverIds(coverIds: number[]): null | string {
  return coverUrlFromCoverId(coverIds.find((coverId) => coverId > 0) ?? null);
}
/**
 * Treats only literal booleans as booleans so truthy strings do not leak into filter logic.
 */
function booleanValue(value: unknown): boolean {
  return value === true;
}
/**
 * Chooses the strongest stable duplicate key available, preferring ISBNs before provider keys and
 * falling back to normalized title/author pairs when provider metadata is missing.
 */
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
/**
 * Collapses duplicate search hits for the same work/edition while keeping the richest candidate.
 */
function dedupeSearchResults(items: NormalizedBookDto[]): NormalizedBookDto[] {
  const bestByKey = new Map<string, NormalizedBookDto>();

  for (const item of items) {
    const key =
      item.openLibraryWorkKey ??
      item.openLibraryEditionKey ??
      `title-author:${normalizeText(item.title)}:${normalizeText(item.primaryAuthor ?? 'unknown')}`;
    const existing = bestByKey.get(key);

    // Open Library often returns several editions for one work; keep the hit with the most useful
    // metadata for cards and later library persistence.
    if (!existing || scoreBookResult(item) > scoreBookResult(existing)) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()];
}
/**
 * Reads descriptions from either a plain string or Open Library's `{ value }` description object.
 */
function descriptionValue(value: unknown): null | string {
  if (isString(value)) {
    return normalizeWhitespace(value);
  }

  const descriptionObject = objectValue(value);
  const description = descriptionObject ? stringValue(descriptionObject.value) : null;

  return description ? normalizeWhitespace(description) : null;
}
/**
 * Reads eBook availability from the direct document first, then from nested edition docs when the
 * search API only exposes availability at the edition level.
 */
function ebookAccessValue(value: JsonObject): null | string {
  const directAccess = stringValue(value.ebook_access);

  if (directAccess) {
    return directAccess;
  }

  const editions = objectValue(value.editions);
  const editionDocs = editions ? objectArrayValue(editions.docs) : [];

  return firstString(
    editionDocs.map((edition) => stringValue(edition.ebook_access)).filter(isString),
  );
}
/**
 * Returns the first valid ISBN of the requested length after stripping common formatting.
 */
function firstIsbn(values: string[], length: 10 | 13): null | string {
  return (
    values
      .map((value) => value.replace(/[-\s]/g, '').toUpperCase())
      .find((value) => (length === 10 ? /^\d{9}[\dX]$/.test(value) : /^\d{13}$/.test(value))) ??
    null
  );
}
/**
 * Returns the first normalized string from an already-filtered list.
 */
function firstString(values: string[]): null | string {
  return values[0] ?? null;
}
/**
 * Narrows unknown values to non-empty strings.
 */
function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
/**
 * Converts bare Open Library ids and canonical keys into one canonical `/works/...` or `/books/...`
 * shape, rejecting mismatched ids.
 */
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
/**
 * Normalizes titles and author names for fallback dedupe keys.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
/**
 * Trims and collapses whitespace from text fields returned by Open Library.
 */
function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
/**
 * Infers the V1 "Readable online / eBook" facet from documented availability fields, with title
 * parsing as a last-resort fallback for records that only advertise format in text.
 */
function readableOnlineValue(
  raw: JsonObject,
  title: string,
  subtitle: null | string,
  ebookAccess: null | string,
): boolean {
  return (
    booleanValue(raw.has_fulltext) ||
    booleanValue(raw.public_scan_b) ||
    readableEbookAccess(ebookAccess) ||
    titleSuggestsEbook(title, subtitle)
  );
}
/**
 * Recognizes Open Library eBook access values that mean a user can read or borrow online.
 */
function readableEbookAccess(value: null | string): boolean {
  if (!value) {
    return false;
  }

  return ['borrowable', 'printdisabled', 'public'].includes(value.toLowerCase());
}
/**
 * Detects explicit eBook wording in title/subtitle when structured availability is absent.
 */
function titleSuggestsEbook(title: string, subtitle: null | string): boolean {
  return /\b(e[-\s]?book|electronic book|digital edition|kindle edition)\b/i.test(
    `${title} ${subtitle ?? ''}`,
  );
}
/**
 * Narrows unknown array values to positive integer ids.
 */
function numberArrayValue(value: unknown): number[] {
  return Array.isArray(value) ? value.map(positiveIntegerValue).filter(isNumber) : [];
}
/**
 * Converts year-like Open Library fields to strings while preserving already-normalized strings.
 */
function numberOrStringAsString(value: unknown): null | string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return stringValue(value);
}
/**
 * Narrows unknown array values to plain JSON objects.
 */
function objectArrayValue(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(objectValue).filter(isObject) : [];
}
/**
 * Narrows unknown values to JSON object records.
 */
function objectValue(value: unknown): JsonObject | null {
  return isObject(value) ? value : null;
}
/**
 * Accepts positive integer metadata and rejects zero, fractions, strings, and missing values.
 */
function positiveIntegerValue(value: unknown): null | number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
/**
 * Builds the persisted provider key from normalized Open Library keys, falling back to title/author
 * only when Open Library does not provide a usable key.
 */
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
/**
 * Scores duplicate search candidates by metadata richness so dedupe keeps the most useful card.
 */
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
/**
 * Builds the public Open Library URL for the best available work or edition key.
 */
function sourceUrlFromKeys(workKey: null | string, editionKey: null | string): null | string {
  const key = workKey ?? editionKey;
  return key ? `${openLibraryWebBaseUrl}${key}` : null;
}
/**
 * Narrows unknown arrays to normalized non-empty strings.
 */
function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString).map(normalizeWhitespace) : [];
}
/**
 * Narrows unknown values to one normalized non-empty string.
 */
function stringValue(value: unknown): null | string {
  return isString(value) ? normalizeWhitespace(value) : null;
}
/**
 * Preserves first occurrence ordering while removing duplicate labels.
 */
function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
/**
 * Extracts the first year-looking token from Open Library publish date strings for decade facets.
 */
function yearFromPublishedDate(value: null | string): null | number {
  if (!value) {
    return null;
  }

  const match = /\b\d{1,4}\b/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[0]);

  return Number.isInteger(year) ? year : null;
}
/**
 * Narrows nullable numbers after array mapping helpers run.
 */
function isNumber(value: null | number): value is number {
  return typeof value === 'number';
}
/**
 * Narrows nullable JSON object values for helper overloads.
 */
function isObject(value: JsonObject | null): value is JsonObject;
/**
 * Narrows unknown values to non-array JSON objects.
 */
function isObject(value: unknown): value is JsonObject;
/**
 * Narrows unknown values to non-array JSON objects.
 */
function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
