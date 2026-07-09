import { ApiProperty } from '@nestjs/swagger';

import { BookSearchFacetsDto } from './book-search-facets.dto';
import { BookSearchFiltersDto } from './book-search-filters.dto';
import { NormalizedBookDto } from './normalized-book.dto';

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

  @ApiProperty({ type: NormalizedBookDto, isArray: true })
  items!: NormalizedBookDto[];
}
