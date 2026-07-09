import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

import { userOwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { CreateShelfRequestDto } from '../shelves/dto/create-shelf-request.dto';
import { DeleteShelfResponseDto } from '../shelves/dto/delete-shelf-response.dto';
import { ShelfResponseDto } from '../shelves/dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from '../shelves/dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from '../shelves/dto/update-shelf-request.dto';
import { ShelvesService } from '../shelves/shelves.service';
import { UsersService } from '../users/users.service';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { CreateAdminUserRequestDto } from './dto/create-admin-user-request.dto';
import { UpdateAdminUserRequestDto } from './dto/update-admin-user-request.dto';

/**
 * Implements admin-only user and shelf management. User operations work directly against accounts;
 * shelf operations delegate to ShelvesService under the selected user's owner context.
 */
type AdminUserRecord = Pick<
  User,
  'createdAt' | 'deactivatedAt' | 'displayName' | 'email' | 'id' | 'role' | 'updatedAt' | 'username'
>;

@Injectable()
export class AdminService {
  /**
   * Receives persistence plus user and shelf application services from Nest.
   */
  public constructor(
    private readonly prisma: PrismaService,
    private readonly shelvesService: ShelvesService,
    private readonly usersService: UsersService,
  ) {}
  /**
   * Creates a user with defaults from the admin page and returns the complete admin response shape.
   */
  public async createUser(dto: CreateAdminUserRequestDto): Promise<AdminUserResponseDto> {
    try {
      const user = await this.usersService.createWithDefaults({
        displayName: this.normalizeOptionalText(dto.displayName),
        email: this.normalizeEmail(dto.email),
        passwordHash: await this.hashPassword(dto.password),
        role: dto.role ?? UserRole.USER,
        username: this.normalizeOptionalUsername(dto.username),
      });

      return this.requireUser(user.id);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }
  /**
   * Marks a user inactive without deleting their library data.
   */
  public async deactivateUser(userId: string): Promise<AdminUserResponseDto> {
    return this.updateUserRecord(userId, { deactivatedAt: new Date() });
  }
  /**
   * Hard-deletes a user; dependent library/session/preference/activity records are removed by
   * database cascade rules.
   */
  public async deleteUser(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }
  /**
   * Lists all shelves for a selected user, including deactivated shelves for admin recovery.
   */
  public async listUserShelves(userId: string): Promise<ShelfResponseDto[]> {
    await this.requireUser(userId);

    return this.shelvesService.listShelves(userOwnerContext(userId), {
      includeDeactivated: true,
    });
  }
  /**
   * Lists authenticated users for the admin page.
   */
  public async listUsers(): Promise<AdminUserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ email: 'asc' }, { createdAt: 'asc' }],
      select: adminUserSelect,
    });

    return users.map((user) => this.toUserResponse(user));
  }
  /**
   * Re-enables a previously deactivated user.
   */
  public async reactivateUser(userId: string): Promise<AdminUserResponseDto> {
    return this.updateUserRecord(userId, { deactivatedAt: null });
  }
  /**
   * Applies partial user edits from admin forms. Omitted fields are untouched; nullable optional
   * fields can be cleared.
   */
  public async updateUser(
    userId: string,
    dto: UpdateAdminUserRequestDto,
  ): Promise<AdminUserResponseDto> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.email) {
      data.email = this.normalizeEmail(dto.email);
    }

    if (Object.hasOwn(dto, 'username')) {
      data.username = dto.username === null ? null : this.normalizeOptionalUsername(dto.username);
    }

    if (Object.hasOwn(dto, 'displayName')) {
      data.displayName = this.normalizeOptionalText(dto.displayName ?? undefined) ?? null;
    }

    if (dto.password) {
      data.passwordHash = await this.hashPassword(dto.password);
    }

    if (dto.role) {
      data.role = dto.role;
    }

    return this.updateUserRecord(userId, data);
  }
  /**
   * Creates a shelf for a selected user through the normal shelf service rules.
   */
  public async createUserShelf(
    userId: string,
    dto: CreateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    await this.requireUser(userId);

    return this.shelvesService.createShelf(userOwnerContext(userId), dto);
  }
  /**
   * Deactivates one selected user's shelf while preserving its memberships.
   */
  public async deactivateUserShelf(userId: string, shelfId: string): Promise<ShelfResponseDto> {
    await this.requireUser(userId);

    return this.shelvesService.deactivateShelf(userOwnerContext(userId), shelfId);
  }
  /**
   * Hard-deletes one selected user's shelf using admin-inclusive visibility.
   */
  public async deleteUserShelf(userId: string, shelfId: string): Promise<DeleteShelfResponseDto> {
    await this.requireUser(userId);

    return this.shelvesService.deleteShelf(userOwnerContext(userId), shelfId, {
      includeDeactivated: true,
    });
  }
  /**
   * Reactivates one selected user's shelf.
   */
  public async reactivateUserShelf(userId: string, shelfId: string): Promise<ShelfResponseDto> {
    await this.requireUser(userId);

    return this.shelvesService.reactivateShelf(userOwnerContext(userId), shelfId);
  }
  /**
   * Renames one selected user's shelf, including deactivated shelves.
   */
  public async updateUserShelf(
    userId: string,
    shelfId: string,
    dto: UpdateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    await this.requireUser(userId);

    return this.shelvesService.updateShelf(userOwnerContext(userId), shelfId, dto, {
      includeDeactivated: true,
    });
  }
  /**
   * Reorders all shelves for a selected user, including deactivated shelves.
   */
  public async updateUserShelfOrder(
    userId: string,
    dto: UpdateShelfOrderRequestDto,
  ): Promise<ShelfResponseDto[]> {
    await this.requireUser(userId);

    return this.shelvesService.updateShelfOrder(userOwnerContext(userId), dto, {
      includeDeactivated: true,
    });
  }
  /**
   * Translates expected Prisma constraint and missing-record errors into API exceptions.
   */
  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email or username is already in use.');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User was not found.');
      }
    }

    throw error;
  }
  /**
   * Hashes admin-created or admin-reset passwords with Argon2id.
   */
  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }
  /**
   * Normalizes emails before uniqueness checks and persistence.
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
  /**
   * Trims optional display names and treats blank input as absent.
   */
  private normalizeOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
  }
  /**
   * Normalizes optional usernames for case-insensitive signin and uniqueness.
   */
  private normalizeOptionalUsername(value: string | undefined): string | undefined {
    const normalized = value?.trim().toLowerCase();

    return normalized ? normalized : undefined;
  }
  /**
   * Fetches a selected user or throws NotFound before delegating to owner-scoped services.
   */
  private async requireUser(userId: string): Promise<AdminUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      select: adminUserSelect,
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    return this.toUserResponse(user);
  }
  /**
   * Applies a user update and maps known Prisma failures to API exceptions.
   */
  private async updateUserRecord(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<AdminUserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        data,
        select: adminUserSelect,
        where: { id: userId },
      });

      return this.toUserResponse(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }
  /**
   * Serializes the admin user record into the admin API response shape.
   */
  private toUserResponse(user: AdminUserRecord): AdminUserResponseDto {
    return {
      createdAt: user.createdAt.toISOString(),
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      role: user.role,
      updatedAt: user.updatedAt.toISOString(),
      username: user.username,
    };
  }
}

const adminUserSelect = {
  createdAt: true,
  deactivatedAt: true,
  displayName: true,
  email: true,
  id: true,
  role: true,
  updatedAt: true,
  username: true,
} satisfies Prisma.UserSelect;
