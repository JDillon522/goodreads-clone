import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Defines the Normalized Book DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class NormalizedBookDto {
  @ApiProperty({ example: 'OPEN_LIBRARY' })
  provider!: 'OPEN_LIBRARY';

  @ApiProperty({ example: 'works:OL262758W' })
  providerKey!: string;

  @ApiProperty({ example: 'works:OL262758W' })
  sourceId!: string;

  @ApiPropertyOptional({
    example: 'https://openlibrary.org/works/OL262758W',
    nullable: true,
    type: String,
  })
  sourceUrl!: null | string;

  @ApiPropertyOptional({ example: '/works/OL262758W', nullable: true, type: String })
  openLibraryWorkKey!: null | string;

  @ApiPropertyOptional({ example: '/books/OL24631830M', nullable: true, type: String })
  openLibraryEditionKey!: null | string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiPropertyOptional({ example: 'A Novel', nullable: true, type: String })
  subtitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  authors!: string[];

  @ApiPropertyOptional({ example: 'Ursula K. Le Guin', nullable: true, type: String })
  primaryAuthor!: null | string;

  @ApiPropertyOptional({ example: 'A science fiction novel.', nullable: true, type: String })
  description!: null | string;

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true, type: String })
  publisher!: null | string;

  @ApiPropertyOptional({ example: '1969', nullable: true, type: String })
  publishedDate!: null | string;

  @ApiPropertyOptional({ example: 'public', nullable: true, type: String })
  ebookAccess!: null | string;

  @ApiProperty({ example: true })
  isReadableOnline!: boolean;

  @ApiPropertyOptional({ example: 304, nullable: true, type: Number })
  pageCount!: null | number;

  @ApiPropertyOptional({
    example: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  isbn10!: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  isbn13!: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  genres!: string[];

  @ApiProperty({ example: 'isbn13:9780441478125' })
  dedupeKey!: string;
}
