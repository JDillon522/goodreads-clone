import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the Book Search Facets DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class BookSearchDecadeFacetDto {
  @ApiProperty({ example: '1960s' })
  label!: string;

  @ApiProperty({ example: '1960s' })
  value!: string;

  @ApiProperty({ example: 1960 })
  yearFrom!: number;

  @ApiProperty({ example: 1969 })
  yearTo!: number;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class BookSearchValueFacetDto {
  @ApiProperty({ example: 'Science fiction' })
  label!: string;

  @ApiProperty({ example: 'Science fiction' })
  value!: string;

  @ApiProperty({ example: 7 })
  count!: number;
}

export class BookSearchFacetsDto {
  @ApiProperty({ type: BookSearchValueFacetDto, isArray: true })
  availability!: BookSearchValueFacetDto[];

  @ApiProperty({ type: BookSearchValueFacetDto, isArray: true })
  printTypes!: BookSearchValueFacetDto[];

  @ApiProperty({ type: BookSearchValueFacetDto, isArray: true })
  sortOptions!: BookSearchValueFacetDto[];
}
