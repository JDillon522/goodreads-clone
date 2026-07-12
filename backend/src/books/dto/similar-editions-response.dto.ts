import { ApiProperty } from '@nestjs/swagger';

import { BookMetadataResponseDto } from './book-metadata-response.dto';

/** Google Books editions whose titles closely match one persisted shared book. */
export class SimilarEditionsResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  bookId!: string;

  @ApiProperty({ isArray: true, type: BookMetadataResponseDto })
  items!: BookMetadataResponseDto[];
}
