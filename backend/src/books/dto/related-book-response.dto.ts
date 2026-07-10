import { ApiProperty } from '@nestjs/swagger';

import { BookCardResponseDto } from './book-card-response.dto';

/**
 * Overview: One related-book recommendation with its score and human-readable reason labels.
 */
export class RelatedBookResponseDto {
  @ApiProperty({ type: BookCardResponseDto })
  book!: BookCardResponseDto;

  @ApiProperty({ example: 72 })
  score!: number;

  @ApiProperty({
    example: ['Same author', 'Shared genre: Science fiction'],
    isArray: true,
    type: String,
  })
  reasons!: string[];
}
