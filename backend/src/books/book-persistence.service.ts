import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { BookProvider, GoogleBooksSyncStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { BookInputDto } from '../library/dto/book-input.dto';
import { normalizeText } from '../library/library-rules';
import { NormalizedBookDto } from './dto/normalized-book.dto';
import {
  GoogleBooksClientService,
  type GoogleBooksVolumeCandidate,
} from './google-books/google-books-client.service';

/**
 * Persists normalized provider books into the shared Book table and enriches Open Library records
 * with Google Books metadata without creating owner-specific library items.
 */
export type BookPersistenceExecutor = Prisma.TransactionClient | PrismaService;

type OpenLibraryBookInput = Pick<
  BookInputDto | NormalizedBookDto,
  | 'authors'
  | 'coverUrl'
  | 'description'
  | 'genres'
  | 'isbn10'
  | 'isbn13'
  | 'openLibraryEditionKey'
  | 'openLibraryWorkKey'
  | 'pageCount'
  | 'primaryAuthor'
  | 'publishedDate'
  | 'publisher'
  | 'sourceId'
  | 'sourceUrl'
  | 'subtitle'
  | 'title'
>;

type PersistedBook = Prisma.BookGetPayload<Record<string, never>>;

type GoogleBooksSyncSource = Pick<
  PersistedBook | OpenLibraryBookInput,
  'isbn10' | 'isbn13' | 'primaryAuthor' | 'title'
>;

@Injectable()
export class BookPersistenceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BookPersistenceService.name);
  /**
   * Receives persistence and Google Books lookup dependencies.
   */
  public constructor(
    private readonly googleBooksClient: GoogleBooksClientService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Saves Open Library search/detail results as permanent shared Book rows.
   */
  public async persistOpenLibraryBooks(books: NormalizedBookDto[]): Promise<void> {
    for (const book of books) {
      const persisted = await this.upsertOpenLibraryBook(this.prisma, book);
      await this.syncGoogleBooks(persisted, book);
    }
  }
  /**
   * Starts a non-blocking sweep for books that still need Google Books enrichment after Nest boots.
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
   * Syncs every book that is still pending or previously failed. This intentionally retries failed
   * books on startup because provider failures can be transient or caused by missing local API keys.
   */
  public async syncPendingGoogleBooks(): Promise<number> {
    const books = await this.prisma.book.findMany({
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      where: {
        googleBooksSyncStatus: {
          in: [GoogleBooksSyncStatus.PENDING, GoogleBooksSyncStatus.FAILED],
        },
      },
    });

    if (books.length === 0) {
      return 0;
    }

    this.logger.log(`Google Books startup sync found ${books.length} book(s).`);

    for (const book of books) {
      try {
        await this.syncGoogleBooks(book, book);
      } catch (error) {
        this.logger.warn(`Google Books startup sync skipped ${book.id}: ${describeError(error)}`);
      }
    }

    return books.length;
  }
  /**
   * Refreshes Google metadata for one persisted book when a user touches that book directly.
   */
  public async syncGoogleBooksForBookId(bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      return;
    }

    await this.syncGoogleBooks(book, book);
  }
  /**
   * Upserts one Open Library book while preserving richer fields already merged from other sources.
   */
  public async upsertOpenLibraryBook(
    executor: BookPersistenceExecutor,
    input: OpenLibraryBookInput,
  ): Promise<PersistedBook> {
    return this.upsertOpenLibraryBookRecord(executor, input);
  }
  /**
   * Stores or refreshes one Open Library-backed shared Book row.
   */
  private async upsertOpenLibraryBookRecord(
    executor: BookPersistenceExecutor,
    input: OpenLibraryBookInput,
  ): Promise<PersistedBook> {
    const existing = await executor.book.findUnique({
      where: {
        sourceProvider_sourceId: {
          sourceId: input.sourceId,
          sourceProvider: BookProvider.OPEN_LIBRARY,
        },
      },
    });
    const incoming = openLibraryData(input);

    if (!existing) {
      return executor.book.create({
        data: {
          ...incoming,
          googleBooksSyncStatus: GoogleBooksSyncStatus.PENDING,
        },
      });
    }

    const merged = mergeBookData(existing, incoming);

    return executor.book.update({
      data: merged,
      where: { id: existing.id },
    });
  }
  /**
   * Merges Google Books data into missing app-owned fields and records sync state.
   */
  private async syncGoogleBooks(book: PersistedBook, source: GoogleBooksSyncSource): Promise<void> {
    if (!shouldSyncGoogle(book)) {
      return;
    }

    try {
      const volume = await this.googleBooksClient.findBestVolume({
        isbn10: source.isbn10 ?? null,
        isbn13: source.isbn13 ?? null,
        primaryAuthor: source.primaryAuthor ?? null,
        title: source.title,
      });

      if (!volume) {
        await this.prisma.book.update({
          data: {
            googleBooksError: null,
            googleBooksSyncedAt: new Date(),
            googleBooksSyncStatus: GoogleBooksSyncStatus.NOT_FOUND,
          },
          where: { id: book.id },
        });
        return;
      }

      await this.prisma.book.update({
        data: mergeGoogleBooksData(book, volume),
        where: { id: book.id },
      });
    } catch (error) {
      this.logger.warn(`Google Books sync failed for ${book.sourceId}: ${describeError(error)}`);
      await this.prisma.book.update({
        data: {
          googleBooksError: describeError(error).slice(0, 1000),
          googleBooksSyncedAt: new Date(),
          googleBooksSyncStatus: GoogleBooksSyncStatus.FAILED,
        },
        where: { id: book.id },
      });
    }
  }
}

/**
 * Converts Open Library DTOs into the shared Book table shape.
 */
function openLibraryData(input: OpenLibraryBookInput): Prisma.BookUncheckedCreateInput {
  return {
    authors: cleanStrings(input.authors),
    coverUrl: input.coverUrl ?? null,
    description: input.description ?? null,
    genres: cleanStrings(input.genres),
    isbn10: input.isbn10 ?? null,
    isbn13: input.isbn13 ?? null,
    normalizedPrimaryAuthor: input.primaryAuthor ? normalizeText(input.primaryAuthor) : null,
    normalizedTitle: normalizeText(input.title),
    openLibraryEditionKey: input.openLibraryEditionKey ?? null,
    openLibraryWorkKey: input.openLibraryWorkKey ?? null,
    pageCount: input.pageCount ?? null,
    primaryAuthor: input.primaryAuthor ?? null,
    publishedDate: input.publishedDate ?? null,
    publisher: input.publisher ?? null,
    rawProviderPayload: openLibraryRawPayload(input),
    sourceId: input.sourceId,
    sourceProvider: BookProvider.OPEN_LIBRARY,
    sourceUrl: input.sourceUrl ?? null,
    subtitle: input.subtitle ?? null,
    title: input.title,
  };
}

/**
 * Keeps existing richer values, fills missing fields from the latest provider result, and unions
 * list fields.
 */
function mergeBookData(
  existing: PersistedBook,
  incoming: Prisma.BookUncheckedCreateInput,
): Prisma.BookUncheckedUpdateInput {
  const title = existing.title || String(incoming.title);
  const primaryAuthor =
    existing.primaryAuthor ?? (incoming.primaryAuthor as null | string | undefined) ?? null;

  const merged: Prisma.BookUncheckedUpdateInput = {
    authors: mergeUnique(existing.authors, (incoming.authors as string[] | undefined) ?? []),
    coverUrl: existing.coverUrl ?? (incoming.coverUrl as null | string | undefined) ?? null,
    description:
      existing.description ?? (incoming.description as null | string | undefined) ?? null,
    genres: mergeUnique(existing.genres, (incoming.genres as string[] | undefined) ?? []),
    isbn10: existing.isbn10 ?? (incoming.isbn10 as null | string | undefined) ?? null,
    isbn13: existing.isbn13 ?? (incoming.isbn13 as null | string | undefined) ?? null,
    normalizedPrimaryAuthor: primaryAuthor ? normalizeText(primaryAuthor) : null,
    normalizedTitle: normalizeText(title),
    openLibraryEditionKey:
      existing.openLibraryEditionKey ??
      (incoming.openLibraryEditionKey as null | string | undefined) ??
      null,
    openLibraryWorkKey:
      existing.openLibraryWorkKey ??
      (incoming.openLibraryWorkKey as null | string | undefined) ??
      null,
    pageCount: existing.pageCount ?? (incoming.pageCount as null | number | undefined) ?? null,
    primaryAuthor,
    publishedDate:
      existing.publishedDate ?? (incoming.publishedDate as null | string | undefined) ?? null,
    publisher: existing.publisher ?? (incoming.publisher as null | string | undefined) ?? null,
    sourceUrl: existing.sourceUrl ?? (incoming.sourceUrl as null | string | undefined) ?? null,
    subtitle: existing.subtitle ?? (incoming.subtitle as null | string | undefined) ?? null,
    title,
  };

  if (existing.rawProviderPayload === null && incoming.rawProviderPayload !== undefined) {
    merged.rawProviderPayload = incoming.rawProviderPayload as Prisma.InputJsonValue;
  }

  return merged;
}

/**
 * Builds a Prisma update that fills missing fields from Google Books and records raw sync payload.
 */
function mergeGoogleBooksData(
  existing: PersistedBook,
  volume: GoogleBooksVolumeCandidate,
): Prisma.BookUncheckedUpdateInput {
  const title = existing.title || volume.title || existing.title;
  const authors = mergeUnique(existing.authors, volume.authors);
  const primaryAuthor = existing.primaryAuthor ?? authors[0] ?? null;

  return {
    authors,
    coverUrl: existing.coverUrl ?? volume.thumbnailUrl,
    description: existing.description ?? volume.description,
    genres: mergeUnique(existing.genres, volume.categories),
    googleBooksError: null,
    googleBooksRawPayload: volume.rawPayload as Prisma.InputJsonValue,
    googleBooksSyncedAt: new Date(),
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: volume.id,
    isbn10: existing.isbn10 ?? volume.isbn10,
    isbn13: existing.isbn13 ?? volume.isbn13,
    normalizedPrimaryAuthor: primaryAuthor ? normalizeText(primaryAuthor) : null,
    normalizedTitle: normalizeText(title),
    pageCount: existing.pageCount ?? volume.pageCount,
    primaryAuthor,
    publishedDate: existing.publishedDate ?? volume.publishedDate,
    publisher: existing.publisher ?? volume.publisher,
    title,
  };
}

function cleanStrings(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function openLibraryRawPayload(input: OpenLibraryBookInput): Prisma.InputJsonObject {
  return {
    authors: cleanStrings(input.authors),
    coverUrl: input.coverUrl ?? null,
    description: input.description ?? null,
    genres: cleanStrings(input.genres),
    isbn10: input.isbn10 ?? null,
    isbn13: input.isbn13 ?? null,
    openLibraryEditionKey: input.openLibraryEditionKey ?? null,
    openLibraryWorkKey: input.openLibraryWorkKey ?? null,
    pageCount: input.pageCount ?? null,
    primaryAuthor: input.primaryAuthor ?? null,
    publishedDate: input.publishedDate ?? null,
    publisher: input.publisher ?? null,
    sourceId: input.sourceId,
    sourceProvider: BookProvider.OPEN_LIBRARY,
    sourceUrl: input.sourceUrl ?? null,
    subtitle: input.subtitle ?? null,
    title: input.title,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown failure';
}

function mergeUnique(left: readonly string[], right: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...left, ...right]) {
    const normalized = normalizeText(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(value);
  }

  return merged;
}

function shouldSyncGoogle(book: PersistedBook): boolean {
  if (
    book.googleBooksSyncStatus === GoogleBooksSyncStatus.SYNCED ||
    book.googleBooksSyncStatus === GoogleBooksSyncStatus.NOT_FOUND
  ) {
    return false;
  }

  return true;
}
