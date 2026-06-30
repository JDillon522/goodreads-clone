import { Injectable } from '@nestjs/common';
import { ThemePreference } from '@prisma/client';
import type { User } from '@prisma/client';

import { defaultShelves } from '../common/shelves/default-shelves';
import { PrismaService } from '../database/prisma.service';

export type AuthUserRecord = Pick<User, 'createdAt' | 'displayName' | 'email' | 'id'>;

export type CreateUserInput = {
  displayName?: string;
  email: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createWithDefaults(input: CreateUserInput): Promise<AuthUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          displayName: input.displayName ?? null,
          email: input.email,
          passwordHash: input.passwordHash,
        },
      });

      const shelves = await Promise.all(
        defaultShelves.map((shelf) =>
          transaction.shelf.create({
            data: {
              isDefault: shelf.isDefault,
              name: shelf.name,
              position: shelf.position,
              slug: shelf.slug,
              userId: user.id,
            },
          }),
        ),
      );

      const defaultShelf = shelves.find((shelf) => shelf.slug === 'want-to-read');

      await transaction.userPreference.create({
        data: {
          defaultShelfId: defaultShelf?.id,
          displayMode: 'grid',
          theme: ThemePreference.SYSTEM,
          userId: user.id,
        },
      });

      return user;
    });
  }

  public async findByEmail(
    email: string,
  ): Promise<(AuthUserRecord & { passwordHash: string }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  public async findById(id: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      select: {
        createdAt: true,
        displayName: true,
        email: true,
        id: true,
      },
      where: { id },
    });
  }
}
