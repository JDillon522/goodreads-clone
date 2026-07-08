import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LibraryItemStatus } from '@prisma/client';

import { LibraryBookResponseDto } from './library-book-response.dto';
import { ShelfSummaryResponseDto } from './shelf-summary-response.dto';

export class LibraryItemResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'isbn13:9780441478125' })
  dedupeKey!: string;

  @ApiProperty({ type: LibraryBookResponseDto })
  book!: LibraryBookResponseDto;

  @ApiProperty({ enum: LibraryItemStatus, example: LibraryItemStatus.WANT_TO_READ })
  status!: LibraryItemStatus;

  @ApiProperty({ isArray: true, type: ShelfSummaryResponseDto })
  shelves!: ShelfSummaryResponseDto[];

  @ApiPropertyOptional({ example: 5, nullable: true, type: Number })
  rating!: null | number;

  @ApiPropertyOptional({ example: 'Bleak, excellent, colder than my inbox.', nullable: true, type: String })
  notes!: null | string;

  @ApiPropertyOptional({ example: 152, nullable: true, type: Number })
  currentPage!: null | number;

  @ApiPropertyOptional({ example: 50, nullable: true, type: Number })
  currentPercent!: null | number;

  @ApiPropertyOptional({ example: '2026-06-29T12:00:00.000Z', format: 'date-time', nullable: true, type: String })
  progressUpdatedAt!: null | string;

  @ApiProperty({ example: '2026-06-29T12:00:00.000Z', format: 'date-time' })
  dateAdded!: string;

  @ApiPropertyOptional({ example: '2026-06-29T12:00:00.000Z', format: 'date-time', nullable: true, type: String })
  dateFinished!: null | string;

  @ApiProperty({ example: '2026-06-29T12:00:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-29T12:00:00.000Z', format: 'date-time' })
  updatedAt!: string;
}
