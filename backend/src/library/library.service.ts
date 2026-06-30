import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventType, BookProvider, Prisma } from '@prisma/client';

import { ActivityService } from '../activity/activity.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
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

type LibraryItemWithRelations = Prisma.LibraryItemGetPayload<{
  include: typeof libraryItemInclude;
}>;

type LibraryExecutor = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LibraryService {
  public constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  public async addLibraryItem(
    owner: OwnerContext,
    dto: AddLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.prisma.$transaction(async (transaction) => {
      const shelf = dto.shelfId
        ? await this.getOwnedShelf(transaction, owner, dto.shelfId)
        : await this.getDefaultShelf(transaction, owner, 'want-to-read');
      const book = await this.upsertBook(transaction, dto.book);
      const duplicate = await transaction.libraryItem.findFirst({
        where: {
          ...this.ownerWhere(owner),
          OR: [{ bookId: book.id }, { dedupeKey: dto.book.dedupeKey }],
        },
      });

      if (duplicate) {
        throw new ConflictException('This book is already in your library.');
      }

      const createdItem = await transaction.libraryItem.create({
        data: {
          bookId: book.id,
          dedupeKey: dto.book.dedupeKey,
          shelfId: shelf.id,
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

    return this.toLibraryItemResponse(item);
  }

  public async deleteLibraryItem(owner: OwnerContext, libraryItemId: string): Promise<void> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);

    await this.prisma.libraryItem.delete({
      where: { id: item.id },
    });
  }

  public async getLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<LibraryItemResponseDto> {
    return this.toLibraryItemResponse(await this.getOwnedLibraryItem(owner, libraryItemId));
  }

  public async listLibraryItems(
    owner: OwnerContext,
    query: LibraryQueryDto,
  ): Promise<LibraryItemResponseDto[]> {
    if (query.shelfId) {
      await this.getOwnedShelf(this.prisma, owner, query.shelfId);
    }

    const items = await this.prisma.libraryItem.findMany({
      include: libraryItemInclude,
      orderBy: [{ dateAdded: 'desc' }, { createdAt: 'desc' }],
      where: {
        ...this.ownerWhere(owner),
        ...(query.shelfId ? { shelfId: query.shelfId } : {}),
      },
    });

    return items.map((item) => this.toLibraryItemResponse(item));
  }

  public async moveLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
    dto: MoveLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    const item = await this.getOwnedLibraryItem(owner, libraryItemId);
    const targetShelf = await this.getOwnedShelf(this.prisma, owner, dto.shelfId);
    const isNewlyFinished = targetShelf.slug === 'read' && !item.dateFinished;
    const now = new Date();

    const movedItem = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.libraryItem.update({
        data: {
          dateFinished:
            targetShelf.slug === 'read' ? (item.dateFinished ?? now) : item.dateFinished,
          shelfId: targetShelf.id,
        },
        include: libraryItemInclude,
        where: { id: item.id },
      });

      await this.activityService.emitWithExecutor(transaction, {
        libraryItemId: updated.id,
        metadata: {
          fromShelfId: item.shelfId,
          toShelfId: targetShelf.id,
        },
        owner,
        type: ActivityEventType.BOOK_MOVED,
      });

      if (isNewlyFinished) {
        await this.activityService.emitWithExecutor(transaction, {
          libraryItemId: updated.id,
          metadata: { shelfId: targetShelf.id },
          owner,
          type: ActivityEventType.BOOK_FINISHED,
        });
      }

      return updated;
    });

    return this.toLibraryItemResponse(movedItem);
  }

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

    if (!hasRating && !hasNotes) {
      return this.toLibraryItemResponse(item);
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

      return updated;
    });

    return this.toLibraryItemResponse(updatedItem);
  }

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
      const targetShelfId = await this.progressTargetShelfId(
        transaction,
        owner,
        item,
        progress.isComplete,
      );
      const wasFinished = Boolean(item.dateFinished);
      const updated = await transaction.libraryItem.update({
        data: {
          currentPage: progress.currentPage,
          currentPercent: progress.currentPercent,
          dateFinished: progress.isComplete ? (item.dateFinished ?? now) : null,
          progressUpdatedAt: now,
          ...(targetShelfId ? { shelfId: targetShelfId } : {}),
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
          metadata: { shelfId: updated.shelfId },
          owner,
          type: ActivityEventType.BOOK_FINISHED,
        });
      }

      return updated;
    });

    return this.toLibraryItemResponse(updatedItem);
  }

  private async getDefaultShelf(
    executor: LibraryExecutor,
    owner: OwnerContext,
    slug: string,
  ): Promise<{ id: string; slug: string }> {
    const shelf = await executor.shelf.findFirst({
      select: { id: true, slug: true },
      where: {
        slug,
        ...this.ownerWhere(owner),
      },
    });

    if (!shelf) {
      throw new BadRequestException(`Default shelf "${slug}" does not exist.`);
    }

    return shelf;
  }

  private async getOwnedLibraryItem(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<LibraryItemWithRelations> {
    const item = await this.prisma.libraryItem.findFirst({
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

  private async getOwnedShelf(
    executor: LibraryExecutor,
    owner: OwnerContext,
    shelfId: string,
  ): Promise<{ id: string; slug: string }> {
    const shelf = await executor.shelf.findFirst({
      select: { id: true, slug: true },
      where: {
        id: shelfId,
        ...this.ownerWhere(owner),
      },
    });

    if (!shelf) {
      throw new NotFoundException('Shelf was not found.');
    }

    return shelf;
  }

  private async progressTargetShelfId(
    executor: LibraryExecutor,
    owner: OwnerContext,
    item: LibraryItemWithRelations,
    isComplete: boolean,
  ): Promise<string | undefined> {
    if (isComplete && item.shelf.slug !== 'read') {
      return (await this.getDefaultShelf(executor, owner, 'read')).id;
    }

    if (!isComplete && (item.shelf.slug === 'read' || item.shelf.slug === 'want-to-read')) {
      return (await this.getDefaultShelf(executor, owner, 'currently-reading')).id;
    }

    return undefined;
  }

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

  private toLibraryItemResponse(item: LibraryItemWithRelations): LibraryItemResponseDto {
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
      shelf: this.toShelfSummary(item.shelf),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toShelfSummary(shelf: LibraryItemWithRelations['shelf']): ShelfSummaryResponseDto {
    return {
      id: shelf.id,
      name: shelf.name,
      position: shelf.position,
      slug: shelf.slug,
    };
  }

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

  private ownerWhere(owner: OwnerContext): ReturnType<typeof ownerRecord> {
    return ownerRecord(owner);
  }
}

const libraryItemInclude = {
  book: true,
  shelf: true,
} satisfies Prisma.LibraryItemInclude;
