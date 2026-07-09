import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Defines the Book Search Filters DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class BookSearchFiltersDto {
  @ApiPropertyOptional({ example: 1960, nullable: true, type: Number })
  yearFrom!: null | number;

  @ApiPropertyOptional({ example: 1969, nullable: true, type: Number })
  yearTo!: null | number;

  @ApiPropertyOptional({ example: 'Science fiction', nullable: true, type: String })
  subject!: null | string;

  @ApiPropertyOptional({ enum: ['ebook'], example: 'ebook', nullable: true })
  format!: 'ebook' | null;
}
