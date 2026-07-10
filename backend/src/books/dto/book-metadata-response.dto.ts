import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoogleBooksSyncStatus } from '@prisma/client';

import type { JsonObject } from '../types/json-object';

/**
 * Public book metadata response built from raw provider payloads plus app-computed summary fields.
 */
export class BookCoverImagesDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  thumbnail!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  card!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  detail!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  theme!: null | string;
}

export class BookExternalLinksDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  preview!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  info!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  canonical!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  webReader!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  buy!: null | string;
}

export class BookSummaryDto {
  @ApiProperty({ example: 'google:zyTCAlFPjgYC' })
  providerKey!: string;

  @ApiProperty({ example: 'isbn13:9780441478125' })
  dedupeKey!: string;

  @ApiPropertyOptional({ example: 'zyTCAlFPjgYC', nullable: true, type: String })
  googleBooksVolumeId!: null | string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiPropertyOptional({ example: 'A Novel', nullable: true, type: String })
  subtitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  authors!: string[];

  @ApiPropertyOptional({ example: 'Ursula K. Le Guin', nullable: true, type: String })
  primaryAuthor!: null | string;

  @ApiPropertyOptional({ example: 'A science fiction novel.', nullable: true, type: String })
  description!: null | string;

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true, type: String })
  publisher!: null | string;

  @ApiPropertyOptional({ example: '1969', nullable: true, type: String })
  publishedDate!: null | string;

  @ApiPropertyOptional({ example: 304, nullable: true, type: Number })
  pageCount!: null | number;

  @ApiPropertyOptional({ example: 'BOOK', nullable: true, type: String })
  printType!: null | string;

  @ApiPropertyOptional({ example: 'en', nullable: true, type: String })
  language!: null | string;

  @ApiPropertyOptional({ example: 4.1, nullable: true, type: Number })
  averageRating!: null | number;

  @ApiPropertyOptional({ example: 120, nullable: true, type: Number })
  ratingsCount!: null | number;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  isbn13!: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  isbn10!: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  categories!: string[];

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  genres!: string[];

  @ApiPropertyOptional({ example: 'SAMPLE', nullable: true, type: String })
  ebookAccess!: null | string;

  @ApiProperty({ example: true })
  isReadableOnline!: boolean;

  @ApiPropertyOptional({
    example:
      'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiProperty({ type: BookCoverImagesDto })
  coverImages!: BookCoverImagesDto;

  @ApiProperty({ type: BookExternalLinksDto })
  externalLinks!: BookExternalLinksDto;
}

export class BookOpenLibraryMetadataDto {
  @ApiPropertyOptional({ example: '/works/OL262758W', nullable: true, type: String })
  workKey!: null | string;

  @ApiPropertyOptional({ example: '/books/OL24631830M', nullable: true, type: String })
  editionKey!: null | string;

  @ApiPropertyOptional({
    example: 'https://openlibrary.org/works/OL262758W',
    nullable: true,
    type: String,
  })
  sourceUrl!: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  subjects!: string[];

  @ApiPropertyOptional({ example: '1969', nullable: true, type: String })
  firstPublishDate!: null | string;

  @ApiPropertyOptional({
    example: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiPropertyOptional({
    additionalProperties: true,
    nullable: true,
    type: 'object',
  })
  raw!: JsonObject | null;
}

export class BookSyncDto {
  @ApiProperty({ enum: GoogleBooksSyncStatus, example: GoogleBooksSyncStatus.SYNCED })
  googleBooksStatus!: GoogleBooksSyncStatus;

  @ApiPropertyOptional({
    example: '2026-07-10T12:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  googleBooksSyncedAt!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  googleBooksError!: null | string;
}

export class BookMetadataResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    additionalProperties: true,
    nullable: true,
    type: 'object',
  })
  google!: JsonObject | null;

  @ApiProperty({ type: BookSummaryDto })
  summary!: BookSummaryDto;

  @ApiProperty({ type: BookOpenLibraryMetadataDto })
  openLibrary!: BookOpenLibraryMetadataDto;

  @ApiProperty({ type: BookSyncDto })
  sync!: BookSyncDto;
}
