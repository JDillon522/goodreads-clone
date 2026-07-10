import { ApiProperty } from '@nestjs/swagger';

import { RelatedBookResponseDto } from './related-book-response.dto';

/**
 * Overview: Response contract for related persisted books around one source book.
 */
export class RelatedBooksResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  bookId!: string;

  @ApiProperty({ isArray: true, type: RelatedBookResponseDto })
  items!: RelatedBookResponseDto[];
}
