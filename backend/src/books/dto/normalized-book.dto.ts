import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  })
  sourceUrl!: null | string;

  @ApiPropertyOptional({ example: '/works/OL262758W', nullable: true })
  openLibraryWorkKey!: null | string;

  @ApiPropertyOptional({ example: '/books/OL24631830M', nullable: true })
  openLibraryEditionKey!: null | string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiPropertyOptional({ example: 'A Novel', nullable: true })
  subtitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  authors!: string[];

  @ApiPropertyOptional({ example: 'Ursula K. Le Guin', nullable: true })
  primaryAuthor!: null | string;

  @ApiPropertyOptional({ example: 'A science fiction novel.', nullable: true })
  description!: null | string;

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true })
  publisher!: null | string;

  @ApiPropertyOptional({ example: '1969', nullable: true })
  publishedDate!: null | string;

  @ApiPropertyOptional({ example: 304, nullable: true })
  pageCount!: null | number;

  @ApiPropertyOptional({
    example: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
    nullable: true,
  })
  coverUrl!: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true })
  isbn10!: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true })
  isbn13!: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  genres!: string[];

  @ApiProperty({ example: 'isbn13:9780441478125' })
  dedupeKey!: string;
}
