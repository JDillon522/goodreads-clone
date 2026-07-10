import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookRelationType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { normalizeText } from '../library/library-rules';
import { BookPersistenceService } from './book-persistence.service';
import { BookCardResponseDto } from './dto/book-card-response.dto';
import { BookSearchFiltersDto } from './dto/book-search-filters.dto';
import { BookSeriesResponseDto } from './dto/book-series-response.dto';
import { RelatedBookResponseDto } from './dto/related-book-response.dto';
import { RelatedBooksResponseDto } from './dto/related-books-response.dto';
import { OpenLibraryClientService } from './open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from './open-library/open-library-normalizer.service';

/**
 * Discovers and persists shared book-to-book metadata such as series placement and related books.
 * V1 combines local database scoring with small opportunistic Open Library searches so the detail
 * page can improve as the shared book table grows.
 */
const bookWithSeriesInclude = {
  seriesEntries: {
    include: {
      series: true,
    },
  },
} satisfies Prisma.BookInclude;

type BookRecord = Prisma.BookGetPayload<Record<string, never>>;
type BookWithSeries = Prisma.BookGetPayload<{ include: typeof bookWithSeriesInclude }>;
type SeriesRecord = Prisma.BookSeriesGetPayload<Record<string, never>>;
type ScoredBook = {
  book: BookWithSeries;
  reasons: string[];
  score: number;
};
type SeriesDetection = {
  confidence: number;
  name: string;
  normalizedName: string;
  position: null | number;
  positionLabel: null | string;
};

const emptyFilters: BookSearchFiltersDto = {
  format: null,
  subject: null,
  yearFrom: null,
  yearTo: null,
};

@Injectable()
export class BookRelationsService {
  private readonly logger = new Logger(BookRelationsService.name);
  /**
   * Receives persistence, provider lookup, normalizer, and Prisma collaborators from Nest.
   */
  public constructor(
    private readonly bookPersistence: BookPersistenceService,
    private readonly openLibraryClient: OpenLibraryClientService,
    private readonly openLibraryNormalizer: OpenLibraryNormalizerService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Returns the detected series for one persisted book, creating the shared series row on demand.
   */
  public async getSeries(bookId: string): Promise<BookSeriesResponseDto> {
    const book = await this.getBook(bookId);
    const series = await this.ensureSeriesMetadata(book);

    if (!series) {
      return {
        bookId,
        entries: [],
        seriesName: null,
      };
    }

    const entries = await this.prisma.bookSeriesEntry.findMany({
      include: {
        book: true,
      },
      where: { seriesId: series.id },
    });

    return {
      bookId,
      entries: entries
        .sort((left, right) => compareSeriesEntries(left, right))
        .map((entry) => ({
          book: toBookCardResponse(entry.book),
          confidence: entry.confidence,
          position: entry.position,
          positionLabel: entry.positionLabel,
        })),
      seriesName: series.name,
    };
  }
  /**
   * Scores local related books and, when needed, seeds a small set of additional Open Library
   * candidates based on author, subject, or detected series name.
   */
  public async getRelatedBooks(bookId: string, limit: number): Promise<RelatedBooksResponseDto> {
    const book = await this.getBook(bookId);
    let related = await this.scoreLocalRelatedBooks(book, limit);

    if (related.length < limit) {
      await this.seedProviderCandidates(book, limit);
      related = await this.scoreLocalRelatedBooks(book, limit);
    }

    const items = related.slice(0, limit);
    await this.persistRelations(book.id, items);

    return {
      bookId,
      items: items.map(toRelatedBookResponse),
    };
  }
  /**
   * Loads one shared book row with series relations or fails with a public 404.
   */
  private async getBook(bookId: string): Promise<BookWithSeries> {
    const book = await this.prisma.book.findUnique({
      include: bookWithSeriesInclude,
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException('Book was not found.');
    }

    return book;
  }
  /**
   * Detects series metadata from persisted provider payloads or title conventions and stores it as
   * reusable shared metadata.
   */
  private async ensureSeriesMetadata(book: BookRecord): Promise<SeriesRecord | null> {
    const existing = await this.prisma.bookSeriesEntry.findFirst({
      include: { series: true },
      where: { bookId: book.id },
    });
    const detection = detectSeries(book);

    if (!detection) {
      return existing?.series ?? null;
    }

    const series = await this.prisma.bookSeries.upsert({
      create: {
        confidence: detection.confidence,
        name: detection.name,
        normalizedName: detection.normalizedName,
        sourceId: book.sourceId,
        sourceProvider: book.sourceProvider,
      },
      update: {
        confidence: Math.max(existing?.confidence ?? 0, detection.confidence),
        name: detection.name,
      },
      where: { normalizedName: detection.normalizedName },
    });

    await this.prisma.bookSeriesEntry.upsert({
      create: {
        bookId: book.id,
        confidence: detection.confidence,
        position: detection.position,
        positionLabel: detection.positionLabel,
        seriesId: series.id,
        sourceProvider: book.sourceProvider,
      },
      update: {
        confidence: detection.confidence,
        position: detection.position,
        positionLabel: detection.positionLabel,
      },
      where: {
        seriesId_bookId: {
          bookId: book.id,
          seriesId: series.id,
        },
      },
    });

    return series;
  }
  /**
   * Finds locally persisted books that share author, subject, publisher, or series metadata with the
   * source book, then scores them for detail-page display.
   */
  private async scoreLocalRelatedBooks(book: BookWithSeries, limit: number): Promise<ScoredBook[]> {
    const sourceSeries = await this.ensureSeriesMetadata(book);
    const sourceAuthor = normalizedAuthor(book);
    const whereClauses: Prisma.BookWhereInput[] = [];

    if (sourceSeries) {
      whereClauses.push({ seriesEntries: { some: { seriesId: sourceSeries.id } } });
    }

    if (sourceAuthor) {
      whereClauses.push({ normalizedPrimaryAuthor: sourceAuthor });
    }

    if (book.genres.length > 0) {
      whereClauses.push({ genres: { hasSome: book.genres.slice(0, 8) } });
    }

    if (book.publisher) {
      whereClauses.push({ publisher: book.publisher });
    }

    if (whereClauses.length === 0) {
      return [];
    }

    const candidates = await this.prisma.book.findMany({
      include: bookWithSeriesInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(limit * 6, 36),
      where: {
        id: { not: book.id },
        OR: whereClauses,
      },
    });
    const scored: ScoredBook[] = [];

    for (const candidate of candidates) {
      const score = await this.scoreCandidate(book, sourceSeries, candidate);

      if (score.score > 0) {
        scored.push(score);
      }
    }

    return scored.sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.book.title.localeCompare(right.book.title);
    });
  }
  /**
   * Applies deterministic scoring rules. Series outranks author, author outranks subject, and
   * publication proximity only acts as a small tie-breaker.
   */
  private async scoreCandidate(
    source: BookWithSeries,
    sourceSeries: SeriesRecord | null,
    candidate: BookWithSeries,
  ): Promise<ScoredBook> {
    const reasons: string[] = [];
    let score = 0;
    const candidateSeries = await this.ensureSeriesMetadata(candidate);

    if (sourceSeries && candidateSeries?.id === sourceSeries.id) {
      score += 100;
      reasons.push(`Same series: ${sourceSeries.name}`);
    }

    if (normalizedAuthor(source) && normalizedAuthor(source) === normalizedAuthor(candidate)) {
      score += 50;
      reasons.push('Same author');
    }

    for (const genre of sharedGenres(source, candidate).slice(0, 3)) {
      score += 12;
      reasons.push(`Shared genre: ${genre}`);
    }

    if (source.publisher && candidate.publisher && source.publisher === candidate.publisher) {
      score += 6;
      reasons.push('Same publisher');
    }

    const yearScore = publicationYearScore(source.publishedDate, candidate.publishedDate);

    if (yearScore > 0) {
      score += yearScore;
      reasons.push('Similar publication era');
    }

    return { book: candidate, reasons: uniqueStrings(reasons), score };
  }
  /**
   * Searches Open Library for a few likely related books and persists the normalized results so the
   * normal local scorer can handle them on the second pass.
   */
  private async seedProviderCandidates(book: BookWithSeries, limit: number): Promise<void> {
    const series = await this.ensureSeriesMetadata(book);
    const queries = uniqueStrings(
      [
        series?.name,
        book.primaryAuthor ?? undefined,
        book.genres[0] ? `subject:${quoteOpenLibraryPhrase(book.genres[0])}` : undefined,
      ].filter(isString),
    ).slice(0, 3);

    for (const query of queries) {
      try {
        const providerLimit = Math.min(Math.max(limit, 6), 12);
        const raw = await this.openLibraryClient.searchBooks({
          limit: providerLimit,
          page: 1,
          query,
        });
        const normalized = this.openLibraryNormalizer.normalizeSearch(raw, {
          filters: emptyFilters,
          limit: providerLimit,
          page: 1,
          query,
        });

        await this.bookPersistence.persistOpenLibraryBooks(
          normalized.items.filter((item) => item.sourceId !== book.sourceId),
        );
      } catch (error) {
        this.logger.warn(
          `Related-book provider seed failed for "${query}": ${describeError(error)}`,
        );
      }
    }
  }
  /**
   * Stores scored relation rows so future requests can inspect or reuse the latest scores.
   */
  private async persistRelations(sourceBookId: string, related: ScoredBook[]): Promise<void> {
    for (const item of related) {
      await this.prisma.bookRelation.upsert({
        create: {
          reasons: item.reasons as Prisma.InputJsonValue,
          score: item.score,
          sourceBookId,
          sourceProvider: item.book.sourceProvider,
          targetBookId: item.book.id,
          type: relationTypeForReasons(item.reasons),
        },
        update: {
          reasons: item.reasons as Prisma.InputJsonValue,
          score: item.score,
          sourceProvider: item.book.sourceProvider,
        },
        where: {
          sourceBookId_targetBookId_type: {
            sourceBookId,
            targetBookId: item.book.id,
            type: relationTypeForReasons(item.reasons),
          },
        },
      });
    }
  }
}

/**
 * Compares series entries by explicit series position first, then publication year and title.
 */
function compareSeriesEntries(
  left: Prisma.BookSeriesEntryGetPayload<{ include: { book: true } }>,
  right: Prisma.BookSeriesEntryGetPayload<{ include: { book: true } }>,
): number {
  if (left.position !== null && right.position !== null && left.position !== right.position) {
    return left.position - right.position;
  }

  if (left.position !== null && right.position === null) {
    return -1;
  }

  if (left.position === null && right.position !== null) {
    return 1;
  }

  const leftYear = yearFromPublishedDate(left.book.publishedDate);
  const rightYear = yearFromPublishedDate(right.book.publishedDate);

  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) {
    return leftYear - rightYear;
  }

  return left.book.title.localeCompare(right.book.title);
}

/**
 * Detects a single best series candidate from provider payloads and common title patterns.
 */
function detectSeries(book: BookRecord): SeriesDetection | null {
  const candidates = [
    ...seriesDetectionsFromJson(book.googleBooksRawPayload, 82),
    ...seriesDetectionsFromJson(book.rawProviderPayload, 70),
    ...seriesDetectionsFromText(book.title, book.subtitle),
  ]
    .map((candidate) => normalizeSeriesDetection(candidate, book.title))
    .filter(isSeriesDetection);

  return (
    candidates.sort((left, right) => {
      if (left.confidence !== right.confidence) {
        return right.confidence - left.confidence;
      }

      if (left.position !== null && right.position === null) {
        return -1;
      }

      if (left.position === null && right.position !== null) {
        return 1;
      }

      return left.name.length - right.name.length;
    })[0] ?? null
  );
}

/**
 * Recursively scans provider payloads for explicit series-ish keys while avoiding generic title
 * fields that are not nested under a series object.
 */
function seriesDetectionsFromJson(value: unknown, confidence: number): SeriesDetection[] {
  const candidates: SeriesDetection[] = [];

  function visit(node: unknown, depth: number, pathHasSeries: boolean): void {
    if (depth > 5 || node === null || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1, pathHasSeries);
      }
      return;
    }

    const record = node as Record<string, unknown>;
    const recordName = seriesNameFromRecord(record, pathHasSeries);

    if (recordName) {
      candidates.push({
        confidence,
        name: recordName,
        normalizedName: normalizeText(recordName),
        position: seriesPositionFromRecord(record),
        positionLabel: seriesPositionLabelFromRecord(record),
      });
    }

    for (const [key, child] of Object.entries(record)) {
      const childPathHasSeries = pathHasSeries || /series/i.test(key);

      if (/series/i.test(key) && typeof child === 'string') {
        candidates.push({
          confidence,
          name: child,
          normalizedName: normalizeText(child),
          position: seriesPositionFromRecord(record),
          positionLabel: seriesPositionLabelFromRecord(record),
        });
      }

      visit(child, depth + 1, childPathHasSeries);
    }
  }

  visit(value, 0, false);

  return candidates;
}

/**
 * Reads common series-name keys from provider records.
 */
function seriesNameFromRecord(
  record: Record<string, unknown>,
  pathHasSeries: boolean,
): null | string {
  for (const key of ['series', 'seriesName', 'series_name', 'seriesTitle', 'series_title']) {
    const value = stringValue(record[key]);

    if (value) {
      return value;
    }
  }

  if (!pathHasSeries) {
    return null;
  }

  for (const key of ['displayName', 'name', 'title']) {
    const value = stringValue(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Extracts series order when provider payloads expose a numeric position field.
 */
function seriesPositionFromRecord(record: Record<string, unknown>): null | number {
  for (const key of [
    'bookDisplayNumber',
    'bookNumber',
    'displayNumber',
    'order',
    'position',
    'series_position',
    'seriesPosition',
    'volumeNumber',
  ]) {
    const position = numberValue(record[key]);

    if (position !== null) {
      return position;
    }
  }

  return null;
}

/**
 * Keeps provider order labels such as "Book 2" when available.
 */
function seriesPositionLabelFromRecord(record: Record<string, unknown>): null | string {
  for (const key of ['bookDisplayNumber', 'displayNumber', 'positionLabel']) {
    const value = stringValue(record[key]);

    if (value) {
      return value;
    }
  }

  const position = seriesPositionFromRecord(record);

  return position === null ? null : `Book ${position}`;
}

/**
 * Parses common human-readable series title conventions from book titles/subtitles.
 */
function seriesDetectionsFromText(title: string, subtitle: null | string): SeriesDetection[] {
  const combined = `${title} ${subtitle ?? ''}`.trim();
  const candidates: SeriesDetection[] = [];
  const parenMatch =
    /\((?<series>[^()#]{3,80}?),\s*(?:book\s*)?#?(?<position>\d+(?:\.\d+)?)\)$/i.exec(title);
  const colonMatch = /^(?<series>[^:#()]{3,80})\s+#(?<position>\d+(?:\.\d+)?):\s+.+$/i.exec(
    combined,
  );
  const bookOfMatch =
    /\b(?:book|volume|vol\.?)\s+(?<position>\d+(?:\.\d+)?)\s+(?:of|in)\s+(?:the\s+)?(?<series>[a-z0-9 '&:.-]{3,80})/i.exec(
      combined,
    );

  for (const match of [parenMatch, colonMatch, bookOfMatch]) {
    const series = stringValue(match?.groups?.['series']);
    const position = numberValue(match?.groups?.['position']);

    if (series) {
      candidates.push({
        confidence: 88,
        name: series.replace(/\s+series$/i, '').trim(),
        normalizedName: normalizeText(series),
        position,
        positionLabel: position === null ? null : `Book ${position}`,
      });
    }
  }

  return candidates;
}

/**
 * Removes bad detections such as the book title itself or generic provider labels.
 */
function normalizeSeriesDetection(
  detection: SeriesDetection,
  title: string,
): SeriesDetection | null {
  const name = detection.name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeText(name);

  if (
    normalizedName.length < 3 ||
    normalizedName === normalizeText(title) ||
    ['book', 'books', 'series', 'volume', 'volumes'].includes(normalizedName)
  ) {
    return null;
  }

  return {
    ...detection,
    name,
    normalizedName,
  };
}

/**
 * Chooses the persisted relation type from the strongest displayed reason.
 */
function relationTypeForReasons(reasons: readonly string[]): BookRelationType {
  if (reasons.some((reason) => reason.startsWith('Same series'))) {
    return BookRelationType.SAME_SERIES;
  }

  if (reasons.includes('Same author')) {
    return BookRelationType.SAME_AUTHOR;
  }

  if (reasons.some((reason) => reason.startsWith('Shared genre'))) {
    return BookRelationType.SAME_SUBJECT;
  }

  return BookRelationType.RELATED;
}

/**
 * Returns a normalized primary author from the persisted field or first author fallback.
 */
function normalizedAuthor(book: BookRecord): null | string {
  if (book.normalizedPrimaryAuthor) {
    return book.normalizedPrimaryAuthor;
  }

  const author = book.primaryAuthor ?? book.authors[0];

  return author ? normalizeText(author) : null;
}

/**
 * Finds shared genres by normalized label while keeping the source book's display casing.
 */
function sharedGenres(source: BookRecord, candidate: BookRecord): string[] {
  const candidateGenres = new Set(candidate.genres.map(normalizeText));

  return uniqueStrings(source.genres.filter((genre) => candidateGenres.has(normalizeText(genre))));
}

/**
 * Gives a small score boost to books published near the source book.
 */
function publicationYearScore(left: null | string, right: null | string): number {
  const leftYear = yearFromPublishedDate(left);
  const rightYear = yearFromPublishedDate(right);

  if (leftYear === null || rightYear === null) {
    return 0;
  }

  const distance = Math.abs(leftYear - rightYear);

  if (distance <= 2) {
    return 8;
  }

  if (distance <= 10) {
    return 4;
  }

  return 0;
}

/**
 * Maps persisted Book rows to the compact frontend card shape.
 */
function toBookCardResponse(book: BookRecord): BookCardResponseDto {
  return {
    authors: book.authors,
    coverUrl: book.coverUrl,
    genres: book.genres,
    id: book.id,
    primaryAuthor: book.primaryAuthor,
    publishedDate: book.publishedDate,
    sourceId: book.sourceId,
    sourceProvider: book.sourceProvider,
    sourceUrl: book.sourceUrl,
    subtitle: book.subtitle,
    title: book.title,
  };
}

/**
 * Maps scored internal candidates to the public related-book response contract.
 */
function toRelatedBookResponse(scored: ScoredBook): RelatedBookResponseDto {
  return {
    book: toBookCardResponse(scored.book),
    reasons: scored.reasons,
    score: scored.score,
  };
}

/**
 * Escapes phrase searches for Open Library's query syntax.
 */
function quoteOpenLibraryPhrase(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown failure';
}

function isSeriesDetection(value: SeriesDetection | null): value is SeriesDetection {
  return value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function numberValue(value: unknown): null | number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = Number(value.replace(/^#/, '').trim());
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function stringValue(value: unknown): null | string {
  return isString(value) ? value.trim().replace(/\s+/g, ' ') : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(value);
  }

  return unique;
}

function yearFromPublishedDate(value: null | string): null | number {
  if (!value) {
    return null;
  }

  const match = /\b\d{4}\b/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[0]);

  return Number.isInteger(year) ? year : null;
}
