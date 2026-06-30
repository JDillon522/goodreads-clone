import { Injectable } from '@nestjs/common';
import { BookProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { BookSearchResponseDto } from '../dto/book-search-response.dto';
import { NormalizedBookDto } from '../dto/normalized-book.dto';
import type { JsonObject } from '../types/json-object';

@Injectable()
export class OpenLibraryCacheService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getBook(providerKey: string): Promise<NormalizedBookDto | null> {
    const cached = await this.findFresh(providerKey);
    return cached && isNormalizedBook(cached) ? cached : null;
  }

  public async getSearch(providerKey: string): Promise<BookSearchResponseDto | null> {
    const cached = await this.findFresh(providerKey);
    return cached && isBookSearchResponse(cached) ? cached : null;
  }

  public async set(
    providerKey: string,
    rawPayload: JsonObject,
    normalizedResult: BookSearchResponseDto | NormalizedBookDto,
    expiresAt: Date,
    query?: string,
  ): Promise<void> {
    await this.prisma.externalBookCache.upsert({
      create: {
        expiresAt,
        normalizedResult: normalizedResult as unknown as Prisma.InputJsonValue,
        provider: BookProvider.OPEN_LIBRARY,
        providerKey,
        query,
        rawPayload: rawPayload as Prisma.InputJsonValue,
      },
      update: {
        expiresAt,
        normalizedResult: normalizedResult as unknown as Prisma.InputJsonValue,
        query,
        rawPayload: rawPayload as Prisma.InputJsonValue,
      },
      where: {
        provider_providerKey: {
          provider: BookProvider.OPEN_LIBRARY,
          providerKey,
        },
      },
    });
  }

  private async findFresh(providerKey: string): Promise<Prisma.JsonValue | null> {
    const cached = await this.prisma.externalBookCache.findUnique({
      select: {
        expiresAt: true,
        normalizedResult: true,
      },
      where: {
        provider_providerKey: {
          provider: BookProvider.OPEN_LIBRARY,
          providerKey,
        },
      },
    });

    if (!cached?.normalizedResult || (cached.expiresAt && cached.expiresAt <= new Date())) {
      return null;
    }

    return cached.normalizedResult;
  }
}

function isBookSearchResponse(value: unknown): value is BookSearchResponseDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.query === 'string' &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.total === 'number' &&
    typeof value.count === 'number' &&
    Array.isArray(value.items)
  );
}

function isNormalizedBook(value: unknown): value is NormalizedBookDto {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.provider === 'OPEN_LIBRARY' &&
    typeof value.providerKey === 'string' &&
    typeof value.sourceId === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.authors) &&
    Array.isArray(value.genres) &&
    typeof value.dedupeKey === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
