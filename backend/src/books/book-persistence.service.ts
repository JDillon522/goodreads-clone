import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { BookProvider, GoogleBooksSyncStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { normalizeText } from '../library/library-rules';
import {
  bookSummary,
  toBookMetadataResponse,
  type BookMetadataRecord,
} from './book-metadata.mapper';
import { BookMetadataResponseDto } from './dto/book-metadata-response.dto';
import { BookSearchFiltersDto } from './dto/book-search-filters.dto';
import { NormalizedBookDto } from './dto/normalized-book.dto';
import {
  GoogleBooksClientService,
  type GoogleBooksVolumeCandidate,
} from './google-books/google-books-client.service';
import { OpenLibraryClientService } from './open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from './open-library/open-library-normalizer.service';

/**
 * Persists Google Books metadata as the shared book cache and enriches cached rows with Open
 * Library fields only when Google did not provide equivalent data.
 */
export type BookPersistenceExecutor = Prisma.TransactionClient | PrismaService;

export type BookIdentity = {
  googleBooksVolumeId?: null | string;
  isbn10?: null | string;
  isbn13?: null | string;
};

type PersistedBook = Prisma.BookGetPayload<Record<string, never>>;

const openLibraryEnrichmentFilters: BookSearchFiltersDto = {
  filter: null,
  orderBy: 'relevance',
  printType: 'books',
};

@Injectable()
export class BookPersistenceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BookPersistenceService.name);
  /**
   * Receives provider clients and Prisma dependencies.
   */
  public constructor(
    private readonly googleBooksClient: GoogleBooksClientService,
    private readonly openLibraryClient: OpenLibraryClientService,
    private readonly openLibraryNormalizer: OpenLibraryNormalizerService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Caches a page of Google Books volumes and returns enriched shared book rows.
   */
  public async persistGoogleBooksVolumes(
    volumes: GoogleBooksVolumeCandidate[],
  ): Promise<PersistedBook[]> {
    const books: PersistedBook[] = [];

    for (const volume of volumes) {
      books.push(await this.upsertAndEnrichGoogleVolume(volume));
    }

    return books;
  }
  /**
   * Starts a non-blocking repair pass for stale cache rows and library ISBNs that need metadata.
   */
  public onApplicationBootstrap(): void {
    if (process.env['NODE_ENV'] === 'test') {
      return;
    }

    void this.syncPendingGoogleBooks().catch((error: unknown) => {
      this.logger.warn(`Google Books startup sync failed: ${describeError(error)}`);
    });
  }
  /**
   * Syncs pending/failed cache rows and creates cache rows for saved library ISBNs without one.
   */
  public async syncPendingGoogleBooks(): Promise<number> {
    let synced = 0;
    const books = await this.prisma.book.findMany({
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      where: {
        sourceProvider: BookProvider.GOOGLE_BOOKS,
        googleBooksSyncStatus: {
          in: [GoogleBooksSyncStatus.PENDING, GoogleBooksSyncStatus.FAILED],
        },
      },
    });

    for (const book of books) {
      try {
        await this.syncGoogleBooks(book, book);
        synced += 1;
      } catch (error) {
        this.logger.warn(`Google Books startup sync skipped ${book.id}: ${describeError(error)}`);
      }
    }

    const identities = await this.prisma.libraryItem.findMany({
      distinct: ['dedupeKey'],
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      select: { isbn10: true, isbn13: true },
    });

    for (const identity of identities) {
      try {
        await this.ensureBookForIdentity(identity);
        synced += 1;
      } catch (error) {
        this.logger.warn(`Google Books library ISBN sync skipped: ${describeError(error)}`);
      }
    }

    return synced;
  }
  /**
   * Loads a Google volume by id, stores it in the shared cache, and enriches it from Open Library.
   */
  public async getOrSyncGoogleVolume(volumeId: string): Promise<PersistedBook | null> {
    const existing = await this.findGoogleBookByIdentity(this.prisma, {
      googleBooksVolumeId: volumeId,
    });

    if (existing && !shouldSyncGoogle(existing)) {
      return existing;
    }

    const volume = await this.googleBooksClient.getVolume(volumeId);

    return volume ? this.upsertAndEnrichGoogleVolume(volume) : existing;
  }
  /**
   * Resolves the metadata cache row for a saved library item identity, fetching it when missing.
   */
  public async ensureBookForIdentity(identity: BookIdentity): Promise<PersistedBook> {
    const normalizedIdentity = normalizeIdentity(identity);
    const googleBook = await this.findGoogleBookByIdentity(this.prisma, normalizedIdentity);
    const fallbackBook = await this.findAnyBookByIdentity(normalizedIdentity);
    const existing =
      googleBook && googleBook.googleBooksSyncStatus !== GoogleBooksSyncStatus.NOT_FOUND
        ? googleBook
        : (fallbackBook ?? googleBook);

    if (existing && !shouldSyncGoogle(existing)) {
      return existing;
    }

    if (existing) {
      return this.syncGoogleBooks(existing, normalizedIdentity);
    }

    const volume = await this.fetchVolumeForIdentity(normalizedIdentity);

    if (volume) {
      return this.upsertAndEnrichGoogleVolume(volume);
    }

    return this.createPlaceholderBook(normalizedIdentity, GoogleBooksSyncStatus.NOT_FOUND);
  }
  /**
   * Converts a cached book row into the public normalized detail/search DTO.
   */
  public toBookMetadata(book: PersistedBook): BookMetadataResponseDto {
    return toBookMetadataResponse(book as BookMetadataRecord);
  }
  /**
   * Upserts one Google Books volume, then applies Open Library enrichment.
   */
  private async upsertAndEnrichGoogleVolume(
    volume: GoogleBooksVolumeCandidate,
  ): Promise<PersistedBook> {
    const book = await this.upsertGoogleBooksVolume(this.prisma, volume);
    return this.enrichFromOpenLibrary(book);
  }
  /**
   * Stores or refreshes one Google Books cache row.
   */
  private async upsertGoogleBooksVolume(
    executor: BookPersistenceExecutor,
    volume: GoogleBooksVolumeCandidate,
  ): Promise<PersistedBook> {
    const incoming = googleBooksData(volume);
    const sourceId = cacheSourceId({
      googleBooksVolumeId: volume.id,
      isbn10: volume.isbn10,
      isbn13: volume.isbn13,
    });
    const existing =
      (await executor.book.findUnique({
        where: {
          sourceProvider_sourceId: {
            sourceId,
            sourceProvider: BookProvider.GOOGLE_BOOKS,
          },
        },
      })) ??
      (await this.findGoogleBookByIdentity(executor, {
        googleBooksVolumeId: volume.id,
        isbn10: volume.isbn10,
        isbn13: volume.isbn13,
      }));

    if (!existing) {
      return executor.book.create({
        data: incoming,
      });
    }

    return executor.book.update({
      data: mergeGoogleBooksData(existing, incoming),
      where: { id: existing.id },
    });
  }
  /**
   * Looks up a Google cache row by ISBN first, then volume id.
   */
  private async findGoogleBookByIdentity(
    executor: BookPersistenceExecutor,
    identity: BookIdentity,
  ): Promise<PersistedBook | null> {
    const clauses = identityWhereClauses(identity);

    if (clauses.length === 0) {
      return null;
    }

    return executor.book.findFirst({
      orderBy: [{ updatedAt: 'desc' }],
      where: {
        sourceProvider: BookProvider.GOOGLE_BOOKS,
        OR: clauses,
      },
    });
  }
  /**
   * Falls back to any cached provider row with matching ISBN so older sample/demo data can still
   * render while Google metadata is being rebuilt.
   */
  private async findAnyBookByIdentity(identity: BookIdentity): Promise<PersistedBook | null> {
    const clauses = identityWhereClauses(identity).filter(
      (clause) => 'isbn10' in clause || 'isbn13' in clause,
    );

    if (clauses.length === 0) {
      return null;
    }

    return this.prisma.book.findFirst({
      orderBy: [{ updatedAt: 'desc' }],
      where: { OR: clauses },
    });
  }
  /**
   * Fetches the best Google volume by volume id or ISBN.
   */
  private async fetchVolumeForIdentity(
    identity: BookIdentity,
  ): Promise<GoogleBooksVolumeCandidate | null> {
    if (identity.googleBooksVolumeId) {
      const volume = await this.googleBooksClient.getVolume(identity.googleBooksVolumeId);

      if (volume) {
        return volume;
      }
    }

    const isbn = identity.isbn13 ?? identity.isbn10;

    if (!isbn) {
      return null;
    }

    const result = await this.googleBooksClient.searchVolumes({
      maxResults: 5,
      orderBy: 'relevance',
      printType: 'books',
      query: `isbn:${isbn}`,
      startIndex: 0,
    });

    return result.items[0] ?? null;
  }
  /**
   * Refreshes a cache row from Google using the strongest identity currently available.
   */
  private async syncGoogleBooks(book: PersistedBook, source: BookIdentity): Promise<PersistedBook> {
    if (!shouldSyncGoogle(book)) {
      return book;
    }

    try {
      const volume = await this.fetchVolumeForIdentity({
        googleBooksVolumeId: source.googleBooksVolumeId ?? book.googleBooksVolumeId,
        isbn10: source.isbn10 ?? book.isbn10,
        isbn13: source.isbn13 ?? book.isbn13,
      });

      if (!volume) {
        return this.prisma.book.update({
          data: {
            googleBooksError: null,
            googleBooksSyncedAt: new Date(),
            googleBooksSyncStatus: GoogleBooksSyncStatus.NOT_FOUND,
          },
          where: { id: book.id },
        });
      }

      return this.upsertAndEnrichGoogleVolume(volume);
    } catch (error) {
      this.logger.warn(`Google Books sync failed for ${book.sourceId}: ${describeError(error)}`);
      return this.prisma.book.update({
        data: {
          googleBooksError: describeError(error).slice(0, 1000),
          googleBooksSyncedAt: new Date(),
          googleBooksSyncStatus: GoogleBooksSyncStatus.FAILED,
        },
        where: { id: book.id },
      });
    }
  }
  /**
   * Adds Open Library keys/subjects and other missing metadata after Google cache writes.
   */
  private async enrichFromOpenLibrary(book: PersistedBook): Promise<PersistedBook> {
    const isbn = book.isbn13 ?? book.isbn10;

    if (!isbn || book.openLibraryWorkKey || book.openLibraryEditionKey) {
      return book;
    }

    try {
      const raw = await this.openLibraryClient.searchBooks({
        limit: 1,
        page: 1,
        query: `isbn:${isbn}`,
      });
      const normalized = this.openLibraryNormalizer.normalizeSearch(raw, {
        filters: openLibraryEnrichmentFilters,
        limit: 1,
        page: 1,
        query: `isbn:${isbn}`,
      });
      const match = normalized.items[0];

      if (!match) {
        return book;
      }

      return this.prisma.book.update({
        data: mergeOpenLibraryData(book, match),
        where: { id: book.id },
      });
    } catch (error) {
      this.logger.warn(
        `Open Library enrichment skipped for ${book.sourceId}: ${describeError(error)}`,
      );
      return book;
    }
  }
  /**
   * Creates a minimal ISBN cache row when provider data is temporarily unavailable.
   */
  private async createPlaceholderBook(
    identity: BookIdentity,
    status: GoogleBooksSyncStatus,
  ): Promise<PersistedBook> {
    const isbn = identity.isbn13 ?? identity.isbn10 ?? identity.googleBooksVolumeId ?? 'unknown';
    const title = identity.isbn13 || identity.isbn10 ? `ISBN ${isbn}` : 'Unknown book';
    const sourceId = cacheSourceId(identity);

    return this.prisma.book.upsert({
      create: {
        googleBooksError: null,
        googleBooksSyncedAt: new Date(),
        googleBooksSyncStatus: status,
        googleBooksVolumeId: identity.googleBooksVolumeId ?? null,
        isbn10: identity.isbn10 ?? null,
        isbn13: identity.isbn13 ?? null,
        normalizedPrimaryAuthor: null,
        normalizedTitle: normalizeText(title),
        rawProviderPayload: {
          legacy: { title },
        } as unknown as Prisma.InputJsonValue,
        sourceId,
        sourceProvider: BookProvider.GOOGLE_BOOKS,
      },
      update: {
        googleBooksSyncedAt: new Date(),
        googleBooksSyncStatus: status,
      },
      where: {
        sourceProvider_sourceId: {
          sourceId,
          sourceProvider: BookProvider.GOOGLE_BOOKS,
        },
      },
    });
  }
}

/**
 * Builds the Book create shape from one Google Books volume. Google values are authoritative.
 */
function googleBooksData(volume: GoogleBooksVolumeCandidate): Prisma.BookUncheckedCreateInput {
  const title = volume.title ?? 'Untitled book';
  const authors = volume.authors.map((author) => author.trim()).filter(Boolean);
  const primaryAuthor = authors[0] ?? null;

  return {
    googleBooksError: null,
    googleBooksRawPayload: volume.rawPayload as unknown as Prisma.InputJsonValue,
    googleBooksSyncedAt: new Date(),
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: volume.id,
    isbn10: volume.isbn10,
    isbn13: volume.isbn13,
    normalizedPrimaryAuthor: primaryAuthor ? normalizeText(primaryAuthor) : null,
    normalizedTitle: normalizeText(title),
    rawProviderPayload: {
      google: volume.rawPayload,
    } as unknown as Prisma.InputJsonValue,
    sourceId: cacheSourceId({
      googleBooksVolumeId: volume.id,
      isbn10: volume.isbn10,
      isbn13: volume.isbn13,
    }),
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: volume.infoLink,
  };
}

/**
 * Applies a fresh Google payload over an existing cache row.
 */
function mergeGoogleBooksData(
  existing: PersistedBook,
  incoming: Prisma.BookUncheckedCreateInput,
): Prisma.BookUncheckedUpdateInput {
  return {
    googleBooksError: null,
    googleBooksRawPayload: incoming.googleBooksRawPayload,
    googleBooksSyncedAt: new Date(),
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId:
      (incoming.googleBooksVolumeId as null | string | undefined) ?? existing.googleBooksVolumeId,
    isbn10: (incoming.isbn10 as null | string | undefined) ?? existing.isbn10,
    isbn13: (incoming.isbn13 as null | string | undefined) ?? existing.isbn13,
    normalizedPrimaryAuthor:
      (incoming.normalizedPrimaryAuthor as null | string | undefined) ??
      existing.normalizedPrimaryAuthor,
    normalizedTitle: String(incoming.normalizedTitle ?? existing.normalizedTitle),
    rawProviderPayload: incoming.rawProviderPayload,
    sourceId: String(incoming.sourceId ?? existing.sourceId),
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: (incoming.sourceUrl as null | string | undefined) ?? existing.sourceUrl,
  };
}

/**
 * Fills only missing Google cache fields with Open Library enrichment data.
 */
function mergeOpenLibraryData(
  existing: PersistedBook,
  openLibrary: NormalizedBookDto,
): Prisma.BookUncheckedUpdateInput {
  const summary = bookSummary(existing as BookMetadataRecord);
  const title = summary.title || openLibrary.title;
  const primaryAuthor = summary.primaryAuthor ?? openLibrary.primaryAuthor;

  return {
    isbn10: existing.isbn10 ?? openLibrary.isbn10,
    isbn13: existing.isbn13 ?? openLibrary.isbn13,
    normalizedPrimaryAuthor: primaryAuthor ? normalizeText(primaryAuthor) : null,
    normalizedTitle: normalizeText(title),
    openLibraryEditionKey: existing.openLibraryEditionKey ?? openLibrary.openLibraryEditionKey,
    openLibraryWorkKey: existing.openLibraryWorkKey ?? openLibrary.openLibraryWorkKey,
    rawProviderPayload: providerPayloadWithOpenLibrary(existing, openLibrary),
  };
}

function cacheSourceId(identity: BookIdentity): string {
  const normalized = normalizeIdentity(identity);

  if (normalized.isbn13) {
    return `isbn13:${normalized.isbn13}`;
  }

  if (normalized.isbn10) {
    return `isbn10:${normalized.isbn10}`;
  }

  return `volume:${normalized.googleBooksVolumeId ?? 'unknown'}`;
}

function cleanIsbn(value: null | string | undefined): null | string {
  const cleaned = value?.replace(/[-\s]/g, '').toUpperCase() ?? '';
  return cleaned || null;
}

function dedupeKeyForIdentity(identity: BookIdentity): string {
  const normalized = normalizeIdentity(identity);

  if (normalized.isbn13) {
    return `isbn13:${normalized.isbn13}`;
  }

  if (normalized.isbn10) {
    return `isbn10:${normalized.isbn10}`;
  }

  return `google:${normalized.googleBooksVolumeId ?? 'unknown'}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown failure';
}

function identityWhereClauses(identity: BookIdentity): Prisma.BookWhereInput[] {
  const normalized = normalizeIdentity(identity);
  const clauses: Prisma.BookWhereInput[] = [];

  if (normalized.isbn13) {
    clauses.push({ isbn13: normalized.isbn13 });
  }

  if (normalized.isbn10) {
    clauses.push({ isbn10: normalized.isbn10 });
  }

  if (normalized.googleBooksVolumeId) {
    clauses.push({ googleBooksVolumeId: normalized.googleBooksVolumeId });
    clauses.push({ sourceId: `volume:${normalized.googleBooksVolumeId}` });
    clauses.push({ sourceId: `google:${normalized.googleBooksVolumeId}` });
  }

  return clauses;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIdentity(identity: BookIdentity): BookIdentity {
  return {
    googleBooksVolumeId: identity.googleBooksVolumeId?.trim() || null,
    isbn10: cleanIsbn(identity.isbn10),
    isbn13: cleanIsbn(identity.isbn13),
  };
}

function providerPayloadWithOpenLibrary(
  existing: PersistedBook,
  openLibrary: NormalizedBookDto,
): Prisma.InputJsonValue {
  const current = isRecord(existing.rawProviderPayload) ? existing.rawProviderPayload : {};

  return {
    ...current,
    google: existing.googleBooksRawPayload ?? current['google'] ?? null,
    openLibrary,
  } as unknown as Prisma.InputJsonValue;
}

function shouldSyncGoogle(book: PersistedBook): boolean {
  return (
    book.sourceProvider === BookProvider.GOOGLE_BOOKS &&
    (book.googleBooksSyncStatus === GoogleBooksSyncStatus.PENDING ||
      book.googleBooksSyncStatus === GoogleBooksSyncStatus.FAILED)
  );
}
