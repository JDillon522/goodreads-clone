import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class BookInputDto {
  @ApiProperty({ example: 'OPEN_LIBRARY' })
  @IsIn(['OPEN_LIBRARY'])
  provider!: 'OPEN_LIBRARY';

  @ApiProperty({ example: 'works:OL262758W' })
  @IsString()
  @MaxLength(160)
  providerKey!: string;

  @ApiProperty({ example: 'works:OL262758W' })
  @IsString()
  @MaxLength(160)
  sourceId!: string;

  @ApiPropertyOptional({ example: 'https://openlibrary.org/works/OL262758W', nullable: true, type: String })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  sourceUrl?: null | string;

  @ApiPropertyOptional({ example: '/works/OL262758W', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  openLibraryWorkKey?: null | string;

  @ApiPropertyOptional({ example: '/books/OL24631830M', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  openLibraryEditionKey?: null | string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ example: 'A Novel', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  authors!: string[];

  @ApiPropertyOptional({ example: 'Ursula K. Le Guin', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  primaryAuthor?: null | string;

  @ApiPropertyOptional({ example: 'A science fiction novel.', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: null | string;

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  publisher?: null | string;

  @ApiPropertyOptional({ example: '1969', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  publishedDate?: null | string;

  @ApiPropertyOptional({ example: 304, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  pageCount?: null | number;

  @ApiPropertyOptional({
    example: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  coverUrl?: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn10?: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn13?: null | string;

  @ApiProperty({ example: ['Science fiction', 'Fiction'], isArray: true, type: String })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  genres!: string[];

  @ApiProperty({ example: 'isbn13:9780441478125' })
  @IsString()
  @MaxLength(220)
  dedupeKey!: string;
}
