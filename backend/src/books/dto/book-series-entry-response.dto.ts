import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BookCardResponseDto } from './book-card-response.dto';

/**
 * Overview: One persisted book's placement within a detected series.
 */
export class BookSeriesEntryResponseDto {
  @ApiProperty({ type: BookCardResponseDto })
  book!: BookCardResponseDto;

  @ApiPropertyOptional({ example: 2, nullable: true, type: Number })
  position!: null | number;

  @ApiPropertyOptional({ example: 'Book 2', nullable: true, type: String })
  positionLabel!: null | string;

  @ApiProperty({ example: 85 })
  confidence!: number;
}
