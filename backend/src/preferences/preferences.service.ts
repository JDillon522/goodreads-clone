import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, ThemePaletteMode, ThemePreference, type UserPreference } from '@prisma/client';

import { bookSummary, type BookMetadataRecord } from '../books/book-metadata.mapper';
import { BookPersistenceService } from '../books/book-persistence.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UpdateThemePreferenceRequestDto } from './dto/update-theme-preference-request.dto';
import { ThemePaletteService } from './theme-palette.service';
import {
  isAllowedOpenLibraryCoverUrl,
  normalizeThemePalette,
  type ThemePalette,
} from './theme-palette-rules';

/**
 * Owns persisted owner theme preferences, including automatic and manually selected book-cover
 * palettes for authenticated users and guest sessions.
 */
type ThemeLibraryItemBase = Prisma.LibraryItemGetPayload<Record<string, never>>;
type ThemeBook = Awaited<ReturnType<BookPersistenceService['ensureBookForIdentity']>>;
type ThemeLibraryItem = ThemeLibraryItemBase & { book: ThemeBook };

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  /**
   * Receives Prisma and the cover palette extractor from Nest.
   */
  public constructor(
    private readonly bookPersistence: BookPersistenceService,
    private readonly paletteService: ThemePaletteService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Loads the current theme settings. Auto-top-book mode refreshes only when the strongest covered
   * book changes or no palette has been generated yet.
   */
  public async getThemePreference(owner: OwnerContext): Promise<ThemePreferenceResponseDto> {
    const preference = await this.loadOrCreatePreference(owner);

    if (preference.themePaletteMode === ThemePaletteMode.AUTO_TOP_BOOK) {
      return this.refreshAutoTopBookPreference(owner, preference);
    }

    if (preference.themePaletteMode === ThemePaletteMode.CUSTOM_BOOK) {
      return this.refreshCustomBookPreference(owner, preference);
    }

    return this.toResponse(preference);
  }
  /**
   * Applies a partial theme update, generating a fresh palette when the mode requires a book cover.
   */
  public async updateThemePreference(
    owner: OwnerContext,
    dto: UpdateThemePreferenceRequestDto,
  ): Promise<ThemePreferenceResponseDto> {
    const preference = await this.loadOrCreatePreference(owner);
    const data: Prisma.UserPreferenceUpdateInput = {};

    if (dto.theme) {
      data.theme = toDatabaseTheme(dto.theme);
    }

    if (dto.paletteMode === 'default') {
      Object.assign(data, this.clearedPaletteData(ThemePaletteMode.DEFAULT));
    }

    if (dto.paletteMode === 'autoTopBook') {
      Object.assign(data, await this.autoTopBookData(owner));
    }

    if (dto.paletteMode === 'customBook') {
      if (!dto.libraryItemId) {
        throw new UnprocessableEntityException('A library item is required for custom themes.');
      }

      Object.assign(data, await this.customBookData(owner, dto.libraryItemId));
    }

    if (Object.keys(data).length === 0) {
      return this.toResponse(preference);
    }

    const updated = await this.prisma.userPreference.update({
      data,
      where: { id: preference.id },
    });

    return this.toResponse(updated);
  }
  /**
   * Builds update data for auto mode. Failures leave the mode enabled but clear stale custom colors.
   */
  private async autoTopBookData(owner: OwnerContext): Promise<Prisma.UserPreferenceUpdateInput> {
    const candidate = await this.findTopThemeItem(owner);

    if (!candidate) {
      return this.clearedPaletteData(ThemePaletteMode.AUTO_TOP_BOOK);
    }

    try {
      return this.paletteDataForItem(
        ThemePaletteMode.AUTO_TOP_BOOK,
        candidate,
        await this.paletteFor(candidate),
      );
    } catch (error) {
      this.logger.warn(`Auto theme palette generation failed: ${describeError(error)}`);
      return this.clearedPaletteData(ThemePaletteMode.AUTO_TOP_BOOK);
    }
  }
  /**
   * Clears any stored palette while preserving the selected palette mode.
   */
  private clearedPaletteData(mode: ThemePaletteMode): Prisma.UserPreferenceUpdateInput {
    return {
      themePalette: Prisma.DbNull,
      themePaletteGeneratedAt: null,
      themePaletteMode: mode,
      themePaletteSourceCoverUrl: null,
      themePaletteSourceLibraryItemId: null,
      themePaletteSourceTitle: null,
    };
  }
  /**
   * Builds update data for a manually selected owned book, surfacing validation errors to callers.
   */
  private async customBookData(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<Prisma.UserPreferenceUpdateInput> {
    const item = await this.findThemeItem(owner, libraryItemId);

    if (!item) {
      throw new UnprocessableEntityException('Book was not found in this library.');
    }

    return this.paletteDataForItem(ThemePaletteMode.CUSTOM_BOOK, item, await this.paletteFor(item));
  }
  /**
   * Locates one owned library item that can act as a custom palette source.
   */
  private async findThemeItem(
    owner: OwnerContext,
    libraryItemId: string,
  ): Promise<ThemeLibraryItem | null> {
    const item = await this.prisma.libraryItem.findFirst({
      where: {
        ...ownerRecord(owner),
        id: libraryItemId,
      },
    });

    return item ? this.withResolvedBook(item) : null;
  }
  /**
   * Finds the strongest covered book: highest rating first, then recent completion/update recency.
   */
  private async findTopThemeItem(owner: OwnerContext): Promise<ThemeLibraryItem | null> {
    const items = await this.prisma.libraryItem.findMany({
      take: 100,
      where: ownerRecord(owner),
    });
    const resolvedItems = await Promise.all(items.map((item) => this.withResolvedBook(item)));

    return (
      resolvedItems
        .filter((item) => {
          const coverUrl = this.themeCoverUrl(item);

          return Boolean(coverUrl && isAllowedOpenLibraryCoverUrl(coverUrl));
        })
        .sort(compareThemeItems)[0] ?? null
    );
  }
  /**
   * Loads existing preferences or creates a default row for older owners that predate preferences.
   */
  private async loadOrCreatePreference(owner: OwnerContext): Promise<UserPreference> {
    const existing = await this.prisma.userPreference.findFirst({
      where: ownerRecord(owner),
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userPreference.create({
      data:
        owner.type === 'user'
          ? { displayMode: 'grid', theme: ThemePreference.SYSTEM, userId: owner.userId }
          : {
              displayMode: 'grid',
              guestSessionId: owner.guestSessionId,
              theme: ThemePreference.SYSTEM,
            },
    });
  }
  /**
   * Resolves the shared metadata cache row for one theme candidate.
   */
  private async withResolvedBook(item: ThemeLibraryItemBase): Promise<ThemeLibraryItem> {
    return {
      ...item,
      book: await this.bookPersistence.ensureBookForIdentity({
        isbn10: item.isbn10,
        isbn13: item.isbn13,
      }),
    };
  }
  /**
   * Validates that an item has a supported cover and generates its light/dark token sets.
   */
  private paletteFor(item: ThemeLibraryItem): Promise<ThemePalette> {
    const coverUrl = this.themeCoverUrl(item);

    if (!coverUrl || !isAllowedOpenLibraryCoverUrl(coverUrl)) {
      throw new UnprocessableEntityException('This book does not have a usable cover.');
    }

    return this.paletteService.createFromCoverUrl(coverUrl);
  }
  /**
   * Converts a generated palette and source item into Prisma update data.
   */
  private paletteDataForItem(
    mode: ThemePaletteMode,
    item: ThemeLibraryItem,
    palette: ThemePalette,
  ): Prisma.UserPreferenceUpdateInput {
    const summary = this.bookSummary(item);

    return {
      themePalette: palette,
      themePaletteGeneratedAt: new Date(),
      themePaletteMode: mode,
      themePaletteSourceCoverUrl: summary.coverImages.theme,
      themePaletteSourceLibraryItemId: item.id,
      themePaletteSourceTitle: summary.title,
    };
  }
  /**
   * Refreshes auto mode only when the selected source no longer matches the strongest candidate.
   */
  private async refreshAutoTopBookPreference(
    owner: OwnerContext,
    preference: UserPreference,
  ): Promise<ThemePreferenceResponseDto> {
    const currentPalette = normalizeThemePalette(preference.themePalette);
    const candidate = await this.findTopThemeItem(owner);

    if (!candidate) {
      return this.toResponse(
        await this.prisma.userPreference.update({
          data: this.clearedPaletteData(ThemePaletteMode.AUTO_TOP_BOOK),
          where: { id: preference.id },
        }),
      );
    }

    if (currentPalette && preference.themePaletteSourceLibraryItemId === candidate.id) {
      return this.toResponse(preference);
    }

    try {
      const updated = await this.prisma.userPreference.update({
        data: this.paletteDataForItem(
          ThemePaletteMode.AUTO_TOP_BOOK,
          candidate,
          await this.paletteFor(candidate),
        ),
        where: { id: preference.id },
      });
      return this.toResponse(updated);
    } catch (error) {
      this.logger.warn(`Auto theme refresh failed: ${describeError(error)}`);
      return this.toResponse(preference);
    }
  }
  /**
   * Regenerates manually selected book palettes when the stored token shape is from an older app
   * version.
   */
  private async refreshCustomBookPreference(
    owner: OwnerContext,
    preference: UserPreference,
  ): Promise<ThemePreferenceResponseDto> {
    const currentPalette = normalizeThemePalette(preference.themePalette);
    const sourceLibraryItemId = preference.themePaletteSourceLibraryItemId;

    if (currentPalette || !sourceLibraryItemId) {
      return this.toResponse(preference);
    }

    const item = await this.findThemeItem(owner, sourceLibraryItemId);
    if (!item) {
      return this.toResponse(preference);
    }

    try {
      const updated = await this.prisma.userPreference.update({
        data: this.paletteDataForItem(
          ThemePaletteMode.CUSTOM_BOOK,
          item,
          await this.paletteFor(item),
        ),
        where: { id: preference.id },
      });
      return this.toResponse(updated);
    } catch (error) {
      this.logger.warn(`Custom theme refresh failed: ${describeError(error)}`);
      return this.toResponse(preference);
    }
  }
  /**
   * Maps a Prisma preference row into the public DTO shape consumed by Angular.
   */
  private toResponse(preference: UserPreference): ThemePreferenceResponseDto {
    const palette = normalizeThemePalette(preference.themePalette);
    const generatedAt = preference.themePaletteGeneratedAt?.toISOString();

    return {
      palette,
      paletteMode: fromDatabasePaletteMode(preference.themePaletteMode),
      source:
        palette && generatedAt
          ? {
              coverUrl: preference.themePaletteSourceCoverUrl,
              generatedAt,
              libraryItemId: preference.themePaletteSourceLibraryItemId,
              title: preference.themePaletteSourceTitle ?? 'Selected book',
            }
          : null,
      theme: fromDatabaseTheme(preference.theme),
    };
  }

  private bookSummary(item: ThemeLibraryItem) {
    return bookSummary(item.book as BookMetadataRecord);
  }

  private themeCoverUrl(item: ThemeLibraryItem): null | string {
    return this.bookSummary(item).coverImages.theme;
  }
}

/**
 * Sorts books for automatic theme selection.
 */
function compareThemeItems(left: ThemeLibraryItem, right: ThemeLibraryItem): number {
  return (
    (right.rating ?? -1) - (left.rating ?? -1) ||
    (right.dateFinished?.getTime() ?? 0) - (left.dateFinished?.getTime() ?? 0) ||
    right.updatedAt.getTime() - left.updatedAt.getTime()
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown failure';
}

function fromDatabasePaletteMode(
  mode: ThemePaletteMode,
): ThemePreferenceResponseDto['paletteMode'] {
  if (mode === ThemePaletteMode.AUTO_TOP_BOOK) {
    return 'autoTopBook';
  }

  if (mode === ThemePaletteMode.CUSTOM_BOOK) {
    return 'customBook';
  }

  return 'default';
}

function fromDatabaseTheme(theme: ThemePreference): ThemePreferenceResponseDto['theme'] {
  if (theme === ThemePreference.DARK) {
    return 'dark';
  }

  if (theme === ThemePreference.LIGHT) {
    return 'light';
  }

  return 'system';
}

function toDatabaseTheme(
  theme: NonNullable<UpdateThemePreferenceRequestDto['theme']>,
): ThemePreference {
  if (theme === 'dark') {
    return ThemePreference.DARK;
  }

  if (theme === 'light') {
    return ThemePreference.LIGHT;
  }

  return ThemePreference.SYSTEM;
}
