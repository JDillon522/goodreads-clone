import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Compact persisted book response used by related-book and series endpoints.
 */
export class BookCardResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiPropertyOptional({ example: 'A Novel', nullable: true, type: String })
  subtitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  authors!: string[];

  @ApiPropertyOptional({ example: 'Ursula K. Le Guin', nullable: true, type: String })
  primaryAuthor!: null | string;

  @ApiPropertyOptional({ example: 'zyTCAlFPjgYC', nullable: true, type: String })
  googleBooksVolumeId!: null | string;

  @ApiPropertyOptional({
    example:
      'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiPropertyOptional({ example: '1969', nullable: true, type: String })
  publishedDate!: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  genres!: string[];

  @ApiProperty({ example: 'GOOGLE_BOOKS' })
  sourceProvider!: string;

  @ApiProperty({ example: 'isbn13:9780441478125' })
  sourceId!: string;

  @ApiPropertyOptional({
    example: 'https://books.google.com/books?id=zyTCAlFPjgYC',
    nullable: true,
    type: String,
  })
  sourceUrl!: null | string;
}
