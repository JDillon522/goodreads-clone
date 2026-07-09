import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityEventType,
  BookProvider,
  LibraryItemStatus,
  Prisma,
  ProgressTrackingMode,
  ThemePreference,
} from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ActivityService } from '../activity/activity.service';
import { guestOwnerContext } from '../common/owner/owner-context';
import { createOpaqueToken, hashOpaqueToken } from '../common/security/opaque-token';
import { defaultShelves, type DefaultShelfSlug } from '../common/shelves/default-shelves';
import { PrismaService } from '../database/prisma.service';
import { normalizeText, roundPercent } from '../library/library-rules';
import { GuestSessionResponseDto } from './dto/guest-session-response.dto';

/**
 * Creates and maintains guest demo sessions. Guest sessions use the same owner-aware shelves,
 * library items, goals, and activity data as authenticated users, but are keyed by an opaque token.
 */
type SampleBook = {
  author?: string;
  coverUrl?: string;
  description?: string;
  genres?: string[];
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  publishedDate?: string;
  publisher?: string;
  title: string;
};

type GuestCleanupResult = {
  deletedSessions: number;
};

type GuestTransaction = Prisma.TransactionClient;

const guestSeedBookLimit = 12;

@Injectable()
export class GuestService {
  /**
   * Receives config, persistence, and activity dependencies from Nest.
   */
  public constructor(
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Deletes expired guest sessions; related demo data is removed by database cascade behavior.
   */
  public async cleanupExpiredSessions(now = new Date()): Promise<GuestCleanupResult> {
    const result = await this.prisma.guestSession.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return { deletedSessions: result.count };
  }
  /**
   * Creates a guest session, default shelves, preferences, a yearly goal, and seeded sample books.
   */
  public async createSession(): Promise<GuestSessionResponseDto> {
    const guestToken = createOpaqueToken();
    const expiresAt = this.dateAfterDays(this.guestSessionTtlDays());
    const sampleBooks = this.loadSampleBooks().slice(0, guestSeedBookLimit);

    const guestSession = await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.guestSession.create({
        data: {
          expiresAt,
          label: 'Guest Demo',
          tokenHash: hashOpaqueToken(guestToken),
        },
      });
      const shelves = await this.createDefaultShelves(transaction, session.id);

      await transaction.userPreference.create({
        data: {
          defaultShelfId: shelves.unshelved.id,
          displayMode: 'grid',
          guestSessionId: session.id,
          theme: ThemePreference.SYSTEM,
        },
      });

      await transaction.readingGoal.create({
        data: {
          guestSessionId: session.id,
          targetBooks: 12,
          year: new Date().getUTCFullYear(),
        },
      });

      for (const [index, sampleBook] of sampleBooks.entries()) {
        await this.createSeedLibraryItem(transaction, session.id, shelves, sampleBook, index);
      }

      await this.activityService.emitWithExecutor(transaction, {
        metadata: {
          bookCount: sampleBooks.length,
          expiresAt: expiresAt.toISOString(),
        },
        owner: guestOwnerContext(session.id),
        type: ActivityEventType.GUEST_SESSION_CREATED,
      });

      return session;
    });

    return {
      expiresAt: guestSession.expiresAt.toISOString(),
      guestToken,
      sessionId: guestSession.id,
      tokenType: 'Bearer',
    };
  }
  /**
   * Persists the standard shelf set for a guest session and returns the ids keyed by slug.
   */
  private async createDefaultShelves(
    transaction: GuestTransaction,
    guestSessionId: string,
  ): Promise<Record<DefaultShelfSlug, { id: string }>> {
    const shelves = await Promise.all(
      defaultShelves.map((shelf) =>
        transaction.shelf.create({
          data: {
            ...shelf,
            guestSessionId,
          },
        }),
      ),
    );

    return {
      'currently-reading': this.requireShelf(shelves, 'currently-reading'),
      read: this.requireShelf(shelves, 'read'),
      unshelved: this.requireShelf(shelves, 'unshelved'),
      'want-to-read': this.requireShelf(shelves, 'want-to-read'),
    };
  }
  /**
   * Creates one sample book and library item with deterministic shelf/status/progress data so the
   * guest experience shows realistic app states.
   */
  private async createSeedLibraryItem(
    transaction: GuestTransaction,
    guestSessionId: string,
    shelves: Record<DefaultShelfSlug, { id: string }>,
    sampleBook: SampleBook,
    index: number,
  ): Promise<void> {
    const sourceId = this.sourceIdForSampleBook(sampleBook);
    const dedupeKey = this.dedupeKeyForSampleBook(sampleBook);
    const shelfSlug = this.shelfSlugForSeedIndex(index);
    const isRead = shelfSlug === 'read';
    const isCurrentlyReading = shelfSlug === 'currently-reading';
    const currentPercent = this.seedProgressPercent(sampleBook, index, isRead, isCurrentlyReading);
    const currentPage =
      currentPercent !== null && sampleBook.pageCount
        ? Math.min(sampleBook.pageCount, Math.round((sampleBook.pageCount * currentPercent) / 100))
        : null;

    const book = await transaction.book.upsert({
      create: this.sampleBookData(sampleBook, sourceId),
      update: this.sampleBookData(sampleBook, sourceId),
      where: {
        sourceProvider_sourceId: {
          sourceId,
          sourceProvider: BookProvider.SAMPLE,
        },
      },
    });
    const libraryItem = await transaction.libraryItem.create({
      data: {
        bookId: book.id,
        currentPage,
        currentPercent,
        dateAdded: this.dateDaysAgo(45 - index),
        dateFinished: isRead ? this.dateDaysAgo(30 - index * 4) : null,
        dedupeKey,
        guestSessionId,
        notes: isRead ? `Guest demo note for ${sampleBook.title}.` : null,
        progressUpdatedAt: currentPercent !== null ? this.dateDaysAgo(index + 1) : null,
        rating: isRead ? 4 + (index % 2) : null,
        shelves: {
          create: {
            shelfId: shelves[shelfSlug].id,
          },
        },
        status: isRead
          ? LibraryItemStatus.READ
          : isCurrentlyReading
            ? LibraryItemStatus.READING
            : LibraryItemStatus.WANT_TO_READ,
      },
    });

    if (currentPercent !== null) {
      await transaction.readingProgressEntry.create({
        data: {
          currentPage,
          currentPercent,
          libraryItemId: libraryItem.id,
          trackingMode: currentPage ? ProgressTrackingMode.PAGE : ProgressTrackingMode.PERCENT,
        },
      });
    }
  }
  /**
   * Calculates guest-session expiration dates.
   */
  private dateAfterDays(days: number): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  /**
   * Creates deterministic-looking historical dates for seeded demo activity.
   */
  private dateDaysAgo(daysAgo: number): Date {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  }
  /**
   * Uses the sample source id as the guest demo dedupe key.
   */
  private dedupeKeyForSampleBook(book: SampleBook): string {
    return this.sourceIdForSampleBook(book);
  }
  /**
   * Reads the guest-session TTL setting with a seven-day default.
   */
  private guestSessionTtlDays(): number {
    return this.configService.get<number>('GUEST_SESSION_TTL_DAYS') ?? 7;
  }
  /**
   * Loads and lightly validates sample books from the repo data file.
   */
  private loadSampleBooks(): SampleBook[] {
    const sampleBooksPath = this.sampleBooksPath();
    const parsed = JSON.parse(readFileSync(sampleBooksPath, 'utf8')) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Sample book data must be an array.');
    }

    return parsed.filter((book): book is SampleBook => this.isSampleBook(book));
  }
  /**
   * Narrows unknown JSON entries to the minimal sample-book shape needed for seeding.
   */
  private isSampleBook(book: unknown): book is SampleBook {
    return (
      typeof book === 'object' &&
      book !== null &&
      'title' in book &&
      typeof (book as { title?: unknown }).title === 'string'
    );
  }
  /**
   * Asserts that the expected default shelf slug was created in the transaction.
   */
  private requireShelf(
    shelves: Array<{ id: string; slug: string }>,
    slug: DefaultShelfSlug,
  ): { id: string } {
    const shelf = shelves.find((candidate) => candidate.slug === slug);

    if (!shelf) {
      throw new Error(`Default shelf ${slug} was not created.`);
    }

    return { id: shelf.id };
  }
  /**
   * Maps sample JSON into the shared Book table shape.
   */
  private sampleBookData(
    book: SampleBook,
    sourceId: string,
  ): Prisma.BookUncheckedCreateInput & Prisma.BookUncheckedUpdateInput {
    return {
      authors: book.author ? [book.author] : [],
      coverUrl: book.coverUrl ?? null,
      description: book.description ?? null,
      genres: book.genres ?? [],
      isbn10: book.isbn10 ?? null,
      isbn13: book.isbn13 ?? null,
      normalizedPrimaryAuthor: book.author ? normalizeText(book.author) : null,
      normalizedTitle: normalizeText(book.title),
      pageCount: book.pageCount ?? null,
      primaryAuthor: book.author ?? null,
      publishedDate: book.publishedDate ?? null,
      publisher: book.publisher ?? null,
      rawProviderPayload: book,
      sourceId,
      sourceProvider: BookProvider.SAMPLE,
      title: book.title,
    };
  }
  /**
   * Assigns deterministic demo progress: read books are complete, currently-reading books are in
   * progress, and want-to-read books have no progress.
   */
  private seedProgressPercent(
    book: SampleBook,
    index: number,
    isRead: boolean,
    isCurrentlyReading: boolean,
  ): null | number {
    if (isRead) {
      return 100;
    }

    if (!isCurrentlyReading) {
      return null;
    }

    const percentage = 25 + index * 7;

    return roundPercent(book.pageCount ? Math.min(85, percentage) : percentage);
  }
  /**
   * Spreads the sample list across read, currently-reading, and want-to-read shelves.
   */
  private shelfSlugForSeedIndex(index: number): DefaultShelfSlug {
    if (index < 4) {
      return 'read';
    }

    if (index < 7) {
      return 'currently-reading';
    }

    return 'want-to-read';
  }
  /**
   * Builds a stable SAMPLE provider id, preferring ISBNs before normalized title/author fallback.
   */
  private sourceIdForSampleBook(book: SampleBook): string {
    if (book.isbn13) {
      return `isbn13:${book.isbn13}`;
    }

    if (book.isbn10) {
      return `isbn10:${book.isbn10}`;
    }

    return `title-author:${normalizeText(book.title)}:${normalizeText(book.author ?? 'unknown')}`;
  }
  /**
   * Resolves the sample-book data path for both repo-root and backend working directories.
   */
  private sampleBooksPath(): string {
    const candidates = [
      resolve(process.cwd(), 'data/sample-books.json'),
      resolve(process.cwd(), '../data/sample-books.json'),
    ];
    const sampleBooksPath = candidates.find((candidate) => existsSync(candidate));

    if (!sampleBooksPath) {
      throw new Error('Could not find data/sample-books.json for guest session seeding.');
    }

    return sampleBooksPath;
  }
}
