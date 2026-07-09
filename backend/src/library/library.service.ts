import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventType, BookProvider, LibraryItemStatus, Prisma } from '@prisma/client';

import { ActivityService } from '../activity/activity.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { AddLibraryItemShelfRequestDto } from './dto/add-library-item-shelf-request.dto';
import { AddLibraryItemRequestDto } from './dto/add-library-item-request.dto';
import { BookInputDto } from './dto/book-input.dto';
import { LibraryBookResponseDto } from './dto/library-book-response.dto';
import { LibraryItemResponseDto } from './dto/library-item-response.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { MoveLibraryItemRequestDto } from './dto/move-library-item-request.dto';
import { ShelfSummaryResponseDto } from './dto/shelf-summary-response.dto';
import { UpdateLibraryItemRequestDto } from './dto/update-library-item-request.dto';
import { UpdateProgressRequestDto } from './dto/update-progress-request.dto';
import { calculateProgress, normalizeText } from './library-rules';

/**
 * Owns the user's or guest's saved library items. This service keeps book persistence, shelf
 * membership, progress updates, ratings, notes, and the effective Unshelved fallback in one place.
 */
type LibraryItemWithRelations = Prisma.LibraryItemGetPayload<{
  include: typeof libraryItemInclude;
}>;

type LibraryExecutor = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LibraryService {
  /**
   * Receives persistence and activity dependencies from Nest.
   */
  public constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Adds an Open Library book to the owner's library, defaulting to Unshelved when no target shelf
   * is supplied. Existing books gain another shelf membership instead of being duplicated.
   */
  public async addLibraryItem(
    owner: OwnerContext,
    dto: AddLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.prisma.$transaction(async (transaction) => {
      const shelf = dto.shelfId
        ? await this.getOwnedShelf(transaction, owner, dto.shelfId)
        : await this.getDefaultShelf(transaction, owner, 'unshelved');
      const book = await this.upsertBook(transaction, dto.book);
      const existingItem = await transaction.libraryItem.findFirst({
        include: libraryItemInclude,
        where: {
          ...this.ownerWhere(owner),
          OR: [{ bookId: book.id }, { dedupeKey: dto.book.dedupeKey }],
        },
      });

      if (existingItem) {
        // Library items can live on multiple shelves; duplicate detection prevents duplicate books
        // while still allowing the user to classify the same item under another shelf.
        if (existingItem.shelves.some((membership) => membership.shelfId === shelf.id)) {
          throw new ConflictException('This book is already on that shelf.');
        }

        await transaction.libraryItemShelf.create({
          data: {
            libraryItemId: existingItem.id,
            shelfId: shelf.id,
          },
        });

        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: existingItem.id,
          metadata: {
            bookId: book.id,
            dedupeKey: dto.book.dedupeKey,
            shelfId: shelf.id,
          },
          owner,
          type: ActivityEventType.BOOK_ADDED,
        });

        return this.getOwnedLibraryItemWithExecutor(transaction, owner, existingItem.id);
      }

      const createdItem = await transaction.libraryItem.create({
        data: {
          bookId: book.id,
          dedupeKey: dto.book.dedupeKey,
          dateFinished: shelf.slug === 'read' ? new Date() : null,
          shelves: {
            create: {
              shelfId: shelf.id,
            },
          },
          status: this.statusForInitialShelf(shelf.slug),
          ...ownerRecord(owner),
        },
        include: libraryItemInclude,
      });

      await this.activityService.emitWithExecutor(transaction, {
        libraryItemId: createdItem.id,
        metadata: {
          bookId: book.id,
          dedupeKey: dto.book.dedupeKey,
          shelfId: shelf.id,
        },
        owner,
        type: ActivityEventType.BOOK_ADDED,
      });

      return createdItem;
    });

    return this.toLibraryItemResponse(owner, item);
  }
  /**
   * Removes an owned library item and its dependent shelf/progress/activity records via Prisma
   * cascade rules.
   */
  public async deleteLibraryItem(owner: OwnerContext, libraryItemId: string): Promise<void> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);

    await this.prisma.libraryItem.delete({
      where: { id: item.id },
    });
  }
  /**
   * Fetches one owned library item and maps inactive-only shelf memberships to effective
   * Unshelved in the response.
   */
  public async getLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<LibraryItemResponseDto> {
    return this.toLibraryItemResponse(owner, await this.getOwnedLibraryItem(owner, libraryItemId));
  }
  /**
   * Lists the owner's library, optionally scoped to one active shelf. Filtering by Unshelved also
   * includes items whose only memberships are inactive shelves.
   */
  public async listLibraryItems(
    owner: OwnerContext,
    query: LibraryQueryDto,
  ): Promise<LibraryItemResponseDto[]> {
    if (query.shelfId) {
      const shelf = await this.getOwnedShelf(this.prisma, owner, query.shelfId);
      const items = await this.prisma.libraryItem.findMany({
        include: libraryItemInclude,
        orderBy: [{ dateAdded: 'desc' }, { createdAt: 'desc' }],
        where: {
          ...this.ownerWhere(owner),
          ...(shelf.slug === 'unshelved'
            ? {
                // Unshelved is both a real shelf and the visible fallback for items orphaned by
                // deactivated shelf memberships.
                OR: [
                  { shelves: { some: { shelfId: query.shelfId } } },
                  {
                    shelves: {
                      none: {
                        shelf: {
                          deactivatedAt: null,
                        },
                      },
                    },
                  },
                ],
              }
            : { shelves: { some: { shelfId: query.shelfId } } }),
        },
      });

      return this.toLibraryItemResponses(owner, items);
    }

    const items = await this.prisma.libraryItem.findMany({
      include: libraryItemInclude,
      orderBy: [{ dateAdded: 'desc' }, { createdAt: 'desc' }],
      where: this.ownerWhere(owner),
    });

    return this.toLibraryItemResponses(owner, items);
  }
  /**
   * Backward-compatible move endpoint that now means "add this shelf membership."
   */
  public async moveLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
    dto: MoveLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.addShelfToLibraryItem(owner, libraryItemId, dto);
  }
  /**
   * Adds another active shelf membership to an owned library item.
   */
  public async addShelfToLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
    dto: AddLibraryItemShelfRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);
    const targetShelf = await this.getOwnedShelf(this.prisma, owner, dto.shelfId);

    if (item.shelves.some((membership) => membership.shelfId === targetShelf.id)) {
      throw new ConflictException('This book is already on that shelf.');
    }

    const updatedItem = await this.prisma.$transaction(async (transaction) => {
      await transaction.libraryItemShelf.create({
        data: {
          libraryItemId: item.id,
          shelfId: targetShelf.id,
        },
      });
      await this.activityService.emitWithExecutor(transaction, {
        libraryItemId: item.id,
        metadata: {
          shelfId: targetShelf.id,
        },
        owner,
        type: ActivityEventType.BOOK_MOVED,
      });

      return this.getOwnedLibraryItemWithExecutor(transaction, owner, item.id);
    });

    return this.toLibraryItemResponse(owner, updatedItem);
  }
  /**
   * Removes one active shelf membership. If this would leave the item with no active shelves, the
   * item is moved to Unshelved unless the user is trying to remove Unshelved itself.
   */
  public async removeShelfFromLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
    shelfId: string,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);
    const membership = item.shelves.find((candidate) => candidate.shelfId === shelfId);

    if (!membership || membership.shelf.deactivatedAt) {
      throw new NotFoundException('This book is not on that shelf.');
    }

    const updatedItem = await this.prisma.$transaction(async (transaction) => {
      const remainingMemberships = item.shelves.filter(
        (candidate) => candidate.shelfId !== shelfId && candidate.shelf.deactivatedAt === null,
      );

      if (remainingMemberships.length === 0) {
        // The UI should never show a shelf-less item. Persist a real Unshelved membership before
        // deleting the last active non-Unshelved membership.
        if (membership.shelf.slug === 'unshelved') {
          throw new BadRequestException('A library item must belong to at least one shelf.');
        }

        const fallbackShelf = await this.getOrCreateUnshelvedShelf(transaction, owner);

        await transaction.libraryItemShelf.create({
          data: {
            libraryItemId: item.id,
            shelfId: fallbackShelf.id,
          },
        });
      }

      await transaction.libraryItemShelf.delete({
        where: {
          libraryItemId_shelfId: {
            libraryItemId: item.id,
            shelfId,
          },
        },
      });

      await this.activityService.emitWithExecutor(transaction, {
        libraryItemId: item.id,
        metadata: { shelfId },
        owner,
        type: ActivityEventType.BOOK_MOVED,
      });

      return this.getOwnedLibraryItemWithExecutor(transaction, owner, item.id);
    });

    return this.toLibraryItemResponse(owner, updatedItem);
  }
  /**
   * Updates detail-page metadata: rating, notes, and explicit reading status. Absent optional
   * fields are left untouched, while present null/blank values clear existing data.
   */
  public async updateLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
    dto: UpdateLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);
    const data: Prisma.LibraryItemUpdateInput = {};
    const hasRating = Object.hasOwn(dto, 'rating');
    const hasNotes = Object.hasOwn(dto, 'notes');

    if (hasRating) {
      data.rating = dto.rating ?? null;
    }

    if (hasNotes) {
      const notes = dto.notes?.trim();
      data.notes = notes ? notes : null;
    }

    if (dto.status) {
      // Status is explicit user intent. Finishing sets the completion date once; leaving READ clears
      // completion metadata instead of preserving stale "finished" state.
      data.status = dto.status;
      data.dateFinished =
        dto.status === LibraryItemStatus.READ ? (item.dateFinished ?? new Date()) : null;
    }

    if (!hasRating && !hasNotes && !dto.status) {
      return this.toLibraryItemResponse(owner, item);
    }

    const updatedItem = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.libraryItem.update({
        data,
        include: libraryItemInclude,
        where: { id: item.id },
      });

      if (hasRating) {
        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: updated.id,
          metadata: { rating: dto.rating ?? null },
          owner,
          type: ActivityEventType.RATING_UPDATED,
        });
      }

      if (hasNotes) {
        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: updated.id,
          metadata: { hasNotes: Boolean(dto.notes?.trim()) },
          owner,
          type: ActivityEventType.NOTES_UPDATED,
        });
      }

      if (dto.status) {
        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: updated.id,
          metadata: { status: dto.status },
          owner,
          type:
            dto.status === LibraryItemStatus.READ
              ? ActivityEventType.BOOK_FINISHED
              : ActivityEventType.PROGRESS_UPDATED,
        });
      }

      return updated;
    });

    return this.toLibraryItemResponse(owner, updatedItem);
  }
  /**
   * Records progress history and updates the current progress snapshot. Progress can promote a
   * WANT_TO_READ item to READING or mark a completed item as READ.
   */
  public async updateProgress(
    owner: OwnerContext,
    libraryItemId: string,
    dto: UpdateProgressRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);
    const progress = calculateProgress({
      currentPage: dto.currentPage,
      currentPercent: dto.currentPercent,
      pageCount: item.book.pageCount,
      trackingMode: dto.trackingMode,
    });
    const now = new Date();

    const updatedItem = await this.prisma.$transaction(async (transaction) => {
      const wasFinished = Boolean(item.dateFinished);
      const nextStatus = progress.isComplete
        ? LibraryItemStatus.READ
        : item.status === LibraryItemStatus.WANT_TO_READ
          ? LibraryItemStatus.READING
          : item.status;
      const nextDateFinished =
        nextStatus === LibraryItemStatus.READ ? (item.dateFinished ?? now) : null;
      const updated = await transaction.libraryItem.update({
        data: {
          currentPage: progress.currentPage,
          currentPercent: progress.currentPercent,
          dateFinished: nextDateFinished,
          progressUpdatedAt: now,
          status: nextStatus,
        },
        include: libraryItemInclude,
        where: { id: item.id },
      });

      await transaction.readingProgressEntry.create({
        data: {
          currentPage: progress.currentPage,
          currentPercent: progress.currentPercent,
          libraryItemId: item.id,
          trackingMode: dto.trackingMode,
        },
      });

      await this.activityService.emitWithExecutor(transaction, {
        libraryItemId: updated.id,
        metadata: {
          currentPage: progress.currentPage,
          currentPercent: progress.currentPercent,
          trackingMode: dto.trackingMode,
        },
        owner,
        type: ActivityEventType.PROGRESS_UPDATED,
      });

      if (progress.isComplete && !wasFinished) {
        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: updated.id,
          metadata: { status: LibraryItemStatus.READ },
          owner,
          type: ActivityEventType.BOOK_FINISHED,
        });
      }

      return updated;
    });

    return this.toLibraryItemResponse(owner, updatedItem);
  }
  /**
   * Fetches an active default shelf for the owner.
   */
  private async getDefaultShelf(
    executor: LibraryExecutor,
    owner: OwnerContext,
    slug: string,
  ): Promise<{ id: string; slug: string }> {
    const shelf = await executor.shelf.findFirst({
      select: { id: true, slug: true },
      where: {
        slug,
        deactivatedAt: null,
        ...this.ownerWhere(owner),
      },
    });

    if (!shelf) {
      throw new BadRequestException(`Default shelf "${slug}" does not exist.`);
    }

    return shelf;
  }
  /**
   * Returns the owner's Unshelved shelf, recreating it only as a defensive fallback for older or
   * damaged data where the protected shelf is missing.
   */
  private async getOrCreateUnshelvedShelf(
    executor: Prisma.TransactionClient,
    owner: OwnerContext,
  ): Promise<{ id: string; slug: string }> {
    const existing = await executor.shelf.findFirst({
      select: { id: true, slug: true },
      where: {
        slug: 'unshelved',
        ...this.ownerWhere(owner),
      },
    });

    if (existing) {
      return existing;
    }

    const lastShelf = await executor.shelf.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
      where: this.ownerWhere(owner),
    });

    const created = await executor.shelf.create({
      data: {
        deactivatedAt: null,
        isDefault: true,
        name: 'Unshelved',
        position: (lastShelf?.position ?? -1) + 1,
        slug: 'unshelved',
        ...ownerRecord(owner),
      },
      select: { id: true, slug: true },
    });

    await this.activityService.emitWithExecutor(executor, {
      metadata: { shelfId: created.id, slug: created.slug },
      owner,
      type: ActivityEventType.SHELF_CREATED,
    });

    return created;
  }
  /**
   * Fetches one library item within the current owner boundary.
   */
  private async getOwnedLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<LibraryItemWithRelations> {
    return this.getOwnedLibraryItemWithExecutor(this.prisma, owner, libraryItemId);
  }
  /**
   * Transaction-aware owned item lookup with book and shelf relations needed for response mapping.
   */
  private async getOwnedLibraryItemWithExecutor(
    executor: LibraryExecutor,
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<LibraryItemWithRelations> {
    const item = await executor.libraryItem.findFirst({
      include: libraryItemInclude,
      where: {
        id: libraryItemId,
        ...this.ownerWhere(owner),
      },
    });

    if (!item) {
      throw new NotFoundException('Library item was not found.');
    }

    return item;
  }
  /**
   * Fetches one active shelf inside the current owner boundary.
   */
  private async getOwnedShelf(
    executor: LibraryExecutor,
    owner: OwnerContext,
    shelfId: string,
  ): Promise<{ id: string; slug: string }> {
    const shelf = await executor.shelf.findFirst({
      select: { id: true, slug: true },
      where: {
        id: shelfId,
        deactivatedAt: null,
        ...this.ownerWhere(owner),
      },
    });

    if (!shelf) {
      throw new NotFoundException('Shelf was not found.');
    }

    return shelf;
  }
  /**
   * Maps the stored book record to the public library book DTO.
   */
  private toBookResponse(book: LibraryItemWithRelations['book']): LibraryBookResponseDto {
    return {
      authors: book.authors,
      coverUrl: book.coverUrl,
      description: book.description,
      genres: book.genres,
      id: book.id,
      isbn10: book.isbn10,
      isbn13: book.isbn13,
      openLibraryEditionKey: book.openLibraryEditionKey,
      openLibraryWorkKey: book.openLibraryWorkKey,
      pageCount: book.pageCount,
      primaryAuthor: book.primaryAuthor,
      publishedDate: book.publishedDate,
      publisher: book.publisher,
      sourceId: book.sourceId,
      sourceProvider: book.sourceProvider,
      sourceUrl: book.sourceUrl,
      subtitle: book.subtitle,
      title: book.title,
    };
  }
  /**
   * Maps a single item through the same fallback path used by list responses.
   */
  private async toLibraryItemResponse(
    owner: OwnerContext,
    item: LibraryItemWithRelations,
  ): Promise<LibraryItemResponseDto> {
    const [response] = await this.toLibraryItemResponses(owner, [item]);

    return response;
  }
  /**
   * Preloads Unshelved only when at least one response item needs the effective fallback shelf.
   */
  private async toLibraryItemResponses(
    owner: OwnerContext,
    items: LibraryItemWithRelations[],
  ): Promise<LibraryItemResponseDto[]> {
    const needsUnshelvedFallback = items.some(
      (item) =>
        item.shelves.filter((membership) => membership.shelf.deactivatedAt === null).length === 0,
    );
    const unshelvedShelf = needsUnshelvedFallback
      ? await this.getUnshelvedShelfSummary(this.prisma, owner)
      : null;

    return items.map((item) => this.toLibraryItemResponseWithFallback(item, unshelvedShelf));
  }
  /**
   * Maps one library item and hides inactive shelves, substituting Unshelved when no active
   * memberships remain.
   */
  private toLibraryItemResponseWithFallback(
    item: LibraryItemWithRelations,
    unshelvedShelf: ShelfSummaryResponseDto | null,
  ): LibraryItemResponseDto {
    const activeShelves = item.shelves
      .filter((membership) => membership.shelf.deactivatedAt === null)
      .map((membership) => this.toShelfSummary(membership.shelf));

    return {
      book: this.toBookResponse(item.book),
      createdAt: item.createdAt.toISOString(),
      currentPage: item.currentPage,
      currentPercent: item.currentPercent ? item.currentPercent.toNumber() : null,
      dateAdded: item.dateAdded.toISOString(),
      dateFinished: item.dateFinished?.toISOString() ?? null,
      dedupeKey: item.dedupeKey,
      id: item.id,
      notes: item.notes,
      progressUpdatedAt: item.progressUpdatedAt?.toISOString() ?? null,
      rating: item.rating,
      shelves: activeShelves.length > 0 ? activeShelves : unshelvedShelf ? [unshelvedShelf] : [],
      status: item.status,
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  /**
   * Fetches the active Unshelved shelf summary required for effective fallback responses.
   */
  private async getUnshelvedShelfSummary(
    executor: LibraryExecutor,
    owner: OwnerContext,
  ): Promise<ShelfSummaryResponseDto> {
    const shelf = await executor.shelf.findFirst({
      select: {
        id: true,
        name: true,
        position: true,
        slug: true,
      },
      where: {
        deactivatedAt: null,
        slug: 'unshelved',
        ...this.ownerWhere(owner),
      },
    });

    if (!shelf) {
      throw new BadRequestException('Unshelved shelf does not exist.');
    }

    return shelf;
  }
  /**
   * Derives the initial explicit reading status from the first shelf a new item is added to.
   */
  private statusForInitialShelf(slug: string): LibraryItemStatus {
    if (slug === 'read') {
      return LibraryItemStatus.READ;
    }

    if (slug === 'currently-reading') {
      return LibraryItemStatus.READING;
    }

    return LibraryItemStatus.WANT_TO_READ;
  }
  /**
   * Maps an active shelf relation to the compact shelf summary shown on library items.
   */
  private toShelfSummary(
    shelf: LibraryItemWithRelations['shelves'][number]['shelf'],
  ): ShelfSummaryResponseDto {
    return {
      id: shelf.id,
      name: shelf.name,
      position: shelf.position,
      slug: shelf.slug,
    };
  }
  /**
   * Upserts the shared Open Library book record that library items reference.
   */
  private async upsertBook(
    executor: LibraryExecutor,
    input: BookInputDto,
  ): Promise<{ id: string }> {
    const sourceProvider = BookProvider.OPEN_LIBRARY;
    const data = {
      authors: input.authors,
      coverUrl: input.coverUrl ?? null,
      description: input.description ?? null,
      genres: input.genres,
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
      sourceId: input.sourceId,
      sourceProvider,
      sourceUrl: input.sourceUrl ?? null,
      subtitle: input.subtitle ?? null,
      title: input.title,
    } satisfies Prisma.BookUncheckedCreateInput;

    return executor.book.upsert({
      create: data,
      select: { id: true },
      update: data,
      where: {
        sourceProvider_sourceId: {
          sourceId: input.sourceId,
          sourceProvider,
        },
      },
    });
  }
  /**
   * Converts the current owner context into a Prisma ownership predicate.
   */
  private ownerWhere(owner: OwnerContext): ReturnType<typeof ownerRecord> {
    return ownerRecord(owner);
  }
}

const libraryItemInclude = {
  book: true,
  shelves: {
    include: {
      shelf: true,
    },
    orderBy: [{ shelf: { position: 'asc' } }, { createdAt: 'asc' }],
  },
} satisfies Prisma.LibraryItemInclude;
