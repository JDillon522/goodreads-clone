import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventType, Prisma } from '@prisma/client';

import { ActivityService } from '../activity/activity.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { CreateShelfRequestDto } from './dto/create-shelf-request.dto';
import { DeleteShelfResponseDto } from './dto/delete-shelf-response.dto';
import { ShelfResponseDto } from './dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from './dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from './dto/update-shelf-request.dto';
import { canDeleteShelf, slugifyShelfName } from './shelf-rules';
import { ShelfSummaryResponseDto } from '../library/dto/shelf-summary-response.dto';

type ShelfWithCount = Prisma.ShelfGetPayload<{
  include: {
    _count: {
      select: {
        libraryItems: true;
      };
    };
  };
}>;

type ShelfVisibilityOptions = {
  includeDeactivated?: boolean;
};

@Injectable()
export class ShelvesService {
  public constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  public async createShelf(
    owner: OwnerContext,
    dto: CreateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    const name = dto.name.trim();
    const slug = await this.generateUniqueSlug(owner, name);
    const position = await this.nextShelfPosition(owner);

    const shelf = await this.prisma.$transaction(async (transaction) => {
      const createdShelf = await transaction.shelf.create({
        data: {
          isDefault: false,
          name,
          position,
          slug,
          ...ownerRecord(owner),
        },
        include: shelfInclude,
      });

      await this.activityService.emitWithExecutor(transaction, {
        metadata: { shelfId: createdShelf.id, slug: createdShelf.slug },
        owner,
        type: ActivityEventType.SHELF_CREATED,
      });

      return createdShelf;
    });

    return this.toShelfResponse(shelf);
  }

  public async deleteShelf(
    owner: OwnerContext,
    shelfId: string,
    options: ShelfVisibilityOptions = {},
  ): Promise<DeleteShelfResponseDto> {
    const shelf = await this.getOwnedShelf(owner, shelfId, options);

    if (!canDeleteShelf(shelf.slug)) {
      throw new BadRequestException('Unshelved cannot be deleted.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const memberships = await transaction.libraryItemShelf.findMany({
        include: {
          libraryItem: {
            include: {
              book: true,
              shelves: {
                include: { shelf: true },
                orderBy: [{ shelf: { position: 'asc' } }, { createdAt: 'asc' }],
              },
            },
          },
        },
        where: { shelfId: shelf.id },
      });
      const needsFallback = memberships.some(
        (membership) =>
          membership.libraryItem.shelves.filter(
            (candidate) => candidate.shelfId !== shelf.id && candidate.shelf.deactivatedAt === null,
          ).length === 0,
      );

      const fallbackShelf = needsFallback
        ? await this.getOrCreateUnshelvedShelf(transaction, owner)
        : null;
      const affectedBooks = memberships.map((membership) => {
        const remainingShelves = membership.libraryItem.shelves
          .filter(
            (candidate) => candidate.shelfId !== shelf.id && candidate.shelf.deactivatedAt === null,
          )
          .map((candidate) => this.toShelfSummary(candidate.shelf));
        const shelves =
          remainingShelves.length > 0
            ? remainingShelves
            : fallbackShelf
              ? [this.toShelfSummary(fallbackShelf)]
              : [];

        return {
          libraryItemId: membership.libraryItem.id,
          shelves,
          title: membership.libraryItem.book.title,
        };
      });

      if (fallbackShelf) {
        await Promise.all(
          memberships
            .filter(
              (membership) =>
                membership.libraryItem.shelves.filter(
                  (candidate) =>
                    candidate.shelfId !== shelf.id && candidate.shelf.deactivatedAt === null,
                ).length === 0,
            )
            .map((membership) =>
              transaction.libraryItemShelf.create({
                data: {
                  libraryItemId: membership.libraryItemId,
                  shelfId: fallbackShelf.id,
                },
              }),
            ),
        );
      }

      await this.activityService.emitWithExecutor(transaction, {
        metadata: { shelfId: shelf.id, slug: shelf.slug },
        owner,
        type: ActivityEventType.SHELF_DELETED,
      });

      await transaction.shelf.delete({
        where: { id: shelf.id },
      });

      return {
        affectedBooks,
        deletedShelfId: shelf.id,
        deletedShelfName: shelf.name,
        fallbackShelfId: fallbackShelf?.id ?? null,
      };
    });
  }

  public async deactivateShelf(owner: OwnerContext, shelfId: string): Promise<ShelfResponseDto> {
    const shelf = await this.getOwnedShelf(owner, shelfId, { includeDeactivated: true });

    if (!canDeleteShelf(shelf.slug)) {
      throw new BadRequestException('Unshelved cannot be deactivated.');
    }

    if (shelf.deactivatedAt) {
      return this.toShelfResponse(shelf);
    }

    const updated = await this.prisma.shelf.update({
      data: { deactivatedAt: new Date() },
      include: shelfInclude,
      where: { id: shelf.id },
    });

    return this.toShelfResponse(updated);
  }

  public async listShelves(
    owner: OwnerContext,
    options: ShelfVisibilityOptions = {},
  ): Promise<ShelfResponseDto[]> {
    const shelves = await this.prisma.shelf.findMany({
      include: shelfInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      where: this.ownerWhereForVisibility(owner, options),
    });

    const effectiveUnshelvedCount = options.includeDeactivated
      ? 0
      : await this.countItemsWithNoActiveShelves(owner);

    return shelves.map((shelf) =>
      this.toShelfResponse(
        shelf,
        shelf.slug === 'unshelved'
          ? shelf._count.libraryItems + effectiveUnshelvedCount
          : undefined,
      ),
    );
  }

  public async updateShelf(
    owner: OwnerContext,
    shelfId: string,
    dto: UpdateShelfRequestDto,
    options: ShelfVisibilityOptions = {},
  ): Promise<ShelfResponseDto> {
    const shelf = await this.getOwnedShelf(owner, shelfId, options);
    const name = dto.name?.trim();

    if (!name) {
      return this.toShelfResponse(shelf);
    }

    const updatedShelf = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.shelf.update({
        data: { name },
        include: shelfInclude,
        where: { id: shelf.id },
      });

      await this.activityService.emitWithExecutor(transaction, {
        metadata: { shelfId: shelf.id, slug: shelf.slug },
        owner,
        type: ActivityEventType.SHELF_RENAMED,
      });

      return updated;
    });

    return this.toShelfResponse(updatedShelf);
  }

  public async updateShelfOrder(
    owner: OwnerContext,
    dto: UpdateShelfOrderRequestDto,
    options: ShelfVisibilityOptions = {},
  ): Promise<ShelfResponseDto[]> {
    const shelves = await this.prisma.shelf.findMany({
      select: { id: true },
      where: this.ownerWhereForVisibility(owner, options),
    });
    const ownedIds = new Set(shelves.map((shelf) => shelf.id));
    const requestedIds = new Set(dto.shelfIds);

    if (ownedIds.size !== requestedIds.size || dto.shelfIds.some((id) => !ownedIds.has(id))) {
      throw new BadRequestException(
        'Shelf order must include every shelf owned by this library exactly once.',
      );
    }

    if (requestedIds.size !== dto.shelfIds.length) {
      throw new BadRequestException('Shelf order cannot contain duplicate shelf ids.');
    }

    await this.prisma.$transaction(
      dto.shelfIds.map((id, position) =>
        this.prisma.shelf.update({
          data: { position },
          where: { id },
        }),
      ),
    );

    return this.listShelves(owner, options);
  }

  public async reactivateShelf(owner: OwnerContext, shelfId: string): Promise<ShelfResponseDto> {
    const shelf = await this.getOwnedShelf(owner, shelfId, { includeDeactivated: true });

    if (!shelf.deactivatedAt) {
      return this.toShelfResponse(shelf);
    }

    const updated = await this.prisma.shelf.update({
      data: { deactivatedAt: null },
      include: shelfInclude,
      where: { id: shelf.id },
    });

    return this.toShelfResponse(updated);
  }

  private async generateUniqueSlug(owner: OwnerContext, name: string): Promise<string> {
    const baseSlug = slugifyShelfName(name);
    const existingShelves = await this.prisma.shelf.findMany({
      select: { slug: true },
      where: this.ownerWhere(owner),
    });
    const existingSlugs = new Set(existingShelves.map((shelf) => shelf.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const candidate = `${baseSlug}-${suffix}`;

      if (!existingSlugs.has(candidate)) {
        return candidate;
      }
    }

    throw new ConflictException('Could not create a unique shelf slug.');
  }

  private async getOwnedShelf(
    owner: OwnerContext,
    shelfId: string,
    options: ShelfVisibilityOptions = {},
  ): Promise<ShelfWithCount> {
    const shelf = await this.prisma.shelf.findFirst({
      include: shelfInclude,
      where: {
        id: shelfId,
        ...this.ownerWhereForVisibility(owner, options),
      },
    });

    if (!shelf) {
      throw new NotFoundException('Shelf was not found.');
    }

    return shelf;
  }

  private async nextShelfPosition(owner: OwnerContext): Promise<number> {
    return this.nextShelfPositionWithExecutor(this.prisma, owner);
  }

  private async nextShelfPositionWithExecutor(
    executor: Prisma.TransactionClient | PrismaService,
    owner: OwnerContext,
  ): Promise<number> {
    const lastShelf = await executor.shelf.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
      where: this.ownerWhere(owner),
    });

    return (lastShelf?.position ?? -1) + 1;
  }

  private async getOrCreateUnshelvedShelf(
    executor: Prisma.TransactionClient,
    owner: OwnerContext,
  ): Promise<ShelfSummaryResponseDto> {
    const existing = await executor.shelf.findFirst({
      select: { id: true, name: true, position: true, slug: true },
      where: {
        slug: 'unshelved',
        ...this.ownerWhere(owner),
      },
    });

    if (existing) {
      return existing;
    }

    const created = await executor.shelf.create({
      data: {
        deactivatedAt: null,
        isDefault: true,
        name: 'Unshelved',
        position: await this.nextShelfPositionWithExecutor(executor, owner),
        slug: 'unshelved',
        ...ownerRecord(owner),
      },
      select: { id: true, name: true, position: true, slug: true },
    });

    await this.activityService.emitWithExecutor(executor, {
      metadata: { shelfId: created.id, slug: created.slug },
      owner,
      type: ActivityEventType.SHELF_CREATED,
    });

    return created;
  }

  private ownerWhere(owner: OwnerContext): Prisma.ShelfWhereInput {
    return ownerRecord(owner);
  }

  private activeOwnerWhere(owner: OwnerContext): Prisma.ShelfWhereInput {
    return {
      deactivatedAt: null,
      ...ownerRecord(owner),
    };
  }

  private ownerWhereForVisibility(
    owner: OwnerContext,
    options: ShelfVisibilityOptions,
  ): Prisma.ShelfWhereInput {
    return options.includeDeactivated ? this.ownerWhere(owner) : this.activeOwnerWhere(owner);
  }

  private countItemsWithNoActiveShelves(owner: OwnerContext): Promise<number> {
    return this.prisma.libraryItem.count({
      where: {
        ...ownerRecord(owner),
        shelves: {
          none: {
            shelf: {
              deactivatedAt: null,
            },
          },
        },
      },
    });
  }

  private toShelfResponse(
    shelf: ShelfWithCount,
    itemCount = shelf._count.libraryItems,
  ): ShelfResponseDto {
    return {
      createdAt: shelf.createdAt.toISOString(),
      deactivatedAt: shelf.deactivatedAt?.toISOString() ?? null,
      id: shelf.id,
      isDefault: shelf.isDefault,
      itemCount,
      name: shelf.name,
      position: shelf.position,
      slug: shelf.slug,
      updatedAt: shelf.updatedAt.toISOString(),
    };
  }

  private toShelfSummary(shelf: ShelfSummaryResponseDto): ShelfSummaryResponseDto {
    return {
      id: shelf.id,
      name: shelf.name,
      position: shelf.position,
      slug: shelf.slug,
    };
  }
}

const shelfInclude = {
  _count: {
    select: {
      libraryItems: true,
    },
  },
} satisfies Prisma.ShelfInclude;
