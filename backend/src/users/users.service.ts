import { Injectable } from '@nestjs/common';
import { ThemePreference } from '@prisma/client';
import type { User } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

export type AuthUserRecord = Pick<User, 'createdAt' | 'displayName' | 'email' | 'id'>;

export type CreateUserInput = {
  displayName?: string;
  email: string;
  passwordHash: string;
};

const defaultShelves = [
  { isDefault: true, name: 'Want to Read', position: 0, slug: 'want-to-read' },
  { isDefault: true, name: 'Currently Reading', position: 1, slug: 'currently-reading' },
  { isDefault: true, name: 'Read', position: 2, slug: 'read' },
] as const;

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
