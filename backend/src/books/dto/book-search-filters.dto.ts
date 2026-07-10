import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  googleBookFilters,
  googleBookOrderOptions,
  googleBookPrintTypes,
  type GoogleBookFilter,
  type GoogleBookOrderBy,
  type GoogleBookPrintType,
} from './book-search-query.dto';

/**
 * Overview: Defines the Book Search Filters DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class BookSearchFiltersDto {
  @ApiPropertyOptional({ enum: googleBookFilters, example: 'ebooks', nullable: true })
  filter!: GoogleBookFilter | null;

  @ApiPropertyOptional({ enum: googleBookPrintTypes, example: 'books' })
  printType!: GoogleBookPrintType;

  @ApiPropertyOptional({ enum: googleBookOrderOptions, example: 'relevance' })
  orderBy!: GoogleBookOrderBy;
}
