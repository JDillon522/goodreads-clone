import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Overview: Defines the Book Search Query DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export const googleBookFilters = ['ebooks', 'free-ebooks', 'full', 'paid-ebooks'] as const;
export const googleBookOrderOptions = ['newest', 'relevance'] as const;
export const googleBookPrintTypes = ['all', 'books', 'magazines'] as const;

export type GoogleBookFilter = (typeof googleBookFilters)[number];
export type GoogleBookOrderBy = (typeof googleBookOrderOptions)[number];
export type GoogleBookPrintType = (typeof googleBookPrintTypes)[number];

export class BookSearchQueryDto {
  @ApiProperty({
    description: 'Search terms for title, author, ISBN, or subject.',
    example: 'the left hand of darkness',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  query!: string;

  @ApiPropertyOptional({ default: 1, example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, example: 10, maximum: 25, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Google Books availability filter.',
    enum: googleBookFilters,
    example: 'ebooks',
  })
  @IsOptional()
  @IsIn(googleBookFilters)
  filter?: GoogleBookFilter;

  @ApiPropertyOptional({
    default: 'books',
    description: 'Google Books print type.',
    enum: googleBookPrintTypes,
    example: 'books',
  })
  @IsOptional()
  @IsIn(googleBookPrintTypes)
  printType?: GoogleBookPrintType;

  @ApiPropertyOptional({
    default: 'relevance',
    description: 'Google Books result ordering.',
    enum: googleBookOrderOptions,
    example: 'relevance',
  })
  @IsOptional()
  @IsIn(googleBookOrderOptions)
  orderBy?: GoogleBookOrderBy;
}
