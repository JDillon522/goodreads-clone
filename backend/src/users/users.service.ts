import { Injectable } from '@nestjs/common';
import { ThemePreference, UserRole } from '@prisma/client';
import type { User } from '@prisma/client';

import { defaultShelves } from '../common/shelves/default-shelves';
import { PrismaService } from '../database/prisma.service';

/**
 * Owns user lookup and account creation with the default Bookshelf data each user needs on first
 * sign-in: shelves and preferences.
 */
export type AuthUserRecord = Pick<
  User,
  'createdAt' | 'deactivatedAt' | 'displayName' | 'email' | 'id' | 'role' | 'username'
>;

export type CreateUserInput = {
  displayName?: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  username?: string;
};

@Injectable()
export class UsersService {
  /**
   * Receives Prisma from Nest.
   */
  public constructor(private readonly prisma: PrismaService) {}
  /**
   * Creates a user plus the initial Unshelved, Want to Read, Currently Reading, and Read shelves.
   */
  public async createWithDefaults(input: CreateUserInput): Promise<AuthUserRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          displayName: input.displayName ?? null,
          email: input.email,
          passwordHash: input.passwordHash,
          role: input.role ?? UserRole.USER,
          username: input.username ?? null,
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

      const defaultShelf = shelves.find((shelf) => shelf.slug === 'unshelved');

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
  /**
   * Finds a user by normalized email for signup, signin, and password reset flows.
   */
  public async findByEmail(
    email: string,
  ): Promise<(AuthUserRecord & { passwordHash: string }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
  /**
   * Finds a user by either normalized email or username for the shared signin field.
   */
  public async findBySigninIdentifier(
    identifier: string,
  ): Promise<(AuthUserRecord & { passwordHash: string }) | null> {
    const normalized = identifier.trim().toLowerCase();

    if (normalized.includes('@')) {
      return this.findByEmail(normalized);
    }

    return this.prisma.user.findUnique({
      where: { username: normalized },
    });
  }
  /**
   * Fetches the public auth user shape by id without exposing password hashes.
   */
  public async findById(id: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      select: {
        createdAt: true,
        deactivatedAt: true,
        displayName: true,
        email: true,
        id: true,
        role: true,
        username: true,
      },
      where: { id },
    });
  }
}
