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
import { ShelfResponseDto } from './dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from './dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from './dto/update-shelf-request.dto';
import { canDeleteShelf, slugifyShelfName } from './shelf-rules';

type ShelfWithCount = Prisma.ShelfGetPayload<{
  include: {
    _count: {
      select: {
        libraryItems: true;
      };
    };
  };
}>;

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

  public async deleteShelf(owner: OwnerContext, shelfId: string): Promise<void> {
    const shelf = await this.getOwnedShelf(owner, shelfId);

    if (!canDeleteShelf(shelf.isDefault)) {
      throw new BadRequestException('Default shelves cannot be deleted.');
    }

    if (shelf._count.libraryItems > 0) {
      throw new BadRequestException('Move or delete shelf books before deleting this shelf.');
    }

    await this.prisma.$transaction(async (transaction) => {
      await this.activityService.emitWithExecutor(transaction, {
        metadata: { shelfId: shelf.id, slug: shelf.slug },
        owner,
        type: ActivityEventType.SHELF_DELETED,
      });

      await transaction.shelf.delete({
        where: { id: shelf.id },
      });
    });
  }

  public async listShelves(owner: OwnerContext): Promise<ShelfResponseDto[]> {
    const shelves = await this.prisma.shelf.findMany({
      include: shelfInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      where: this.ownerWhere(owner),
    });

    return shelves.map((shelf) => this.toShelfResponse(shelf));
  }

  public async updateShelf(
    owner: OwnerContext,
    shelfId: string,
    dto: UpdateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    const shelf = await this.getOwnedShelf(owner, shelfId);
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
  ): Promise<ShelfResponseDto[]> {
    const shelves = await this.prisma.shelf.findMany({
      select: { id: true },
      where: this.ownerWhere(owner),
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

    return this.listShelves(owner);
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

  private async getOwnedShelf(owner: OwnerContext, shelfId: string): Promise<ShelfWithCount> {
    const shelf = await this.prisma.shelf.findFirst({
      include: shelfInclude,
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

  private async nextShelfPosition(owner: OwnerContext): Promise<number> {
    const lastShelf = await this.prisma.shelf.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
      where: this.ownerWhere(owner),
    });

    return (lastShelf?.position ?? -1) + 1;
  }

  private ownerWhere(owner: OwnerContext): Prisma.ShelfWhereInput {
    return ownerRecord(owner);
  }

  private toShelfResponse(shelf: ShelfWithCount): ShelfResponseDto {
    return {
      createdAt: shelf.createdAt.toISOString(),
      id: shelf.id,
      isDefault: shelf.isDefault,
      itemCount: shelf._count.libraryItems,
      name: shelf.name,
      position: shelf.position,
      slug: shelf.slug,
      updatedAt: shelf.updatedAt.toISOString(),
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
