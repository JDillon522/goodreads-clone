import { ApiProperty } from '@nestjs/swagger';

import { BookMetadataResponseDto } from './book-metadata-response.dto';
import { BookSearchFacetsDto } from './book-search-facets.dto';
import { BookSearchFiltersDto } from './book-search-filters.dto';

/**
 * Overview: Defines the Book Search Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class BookSearchResponseDto {
  @ApiProperty({ example: 'the left hand of darkness' })
  query!: string;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 143 })
  total!: number;

  @ApiProperty({ example: 10 })
  count!: number;

  @ApiProperty({ type: BookSearchFiltersDto })
  filters!: BookSearchFiltersDto;

  @ApiProperty({ type: BookSearchFacetsDto })
  facets!: BookSearchFacetsDto;

  @ApiProperty({ type: BookMetadataResponseDto, isArray: true })
  items!: BookMetadataResponseDto[];
}
