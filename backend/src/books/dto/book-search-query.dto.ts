import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 1960, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearFrom?: number;

  @ApiPropertyOptional({ example: 1969, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearTo?: number;

  @ApiPropertyOptional({ example: 'Science fiction', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subject?: string;

  @ApiPropertyOptional({ enum: ['ebook'], example: 'ebook' })
  @IsOptional()
  @IsIn(['ebook'])
  format?: 'ebook';
}
