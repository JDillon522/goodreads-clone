import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BookSeriesEntryResponseDto } from './book-series-entry-response.dto';

/**
 * Overview: Response contract for the detected series context around one persisted book.
 */
export class BookSeriesResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  bookId!: string;

  @ApiPropertyOptional({ example: 'The Expanse', nullable: true, type: String })
  seriesName!: null | string;

  @ApiProperty({ isArray: true, type: BookSeriesEntryResponseDto })
  entries!: BookSeriesEntryResponseDto[];
}
