import { ApiProperty } from '@nestjs/swagger';

import { NormalizedBookDto } from './normalized-book.dto';

export class BookSearchResponseDto {
  @ApiProperty({ example: 'the left hand of darkness' })
  query!: string;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 143 })
  total!: number;

  @ApiProperty({ example: 10 })
  count!: number;

  @ApiProperty({ type: NormalizedBookDto, isArray: true })
  items!: NormalizedBookDto[];
}
