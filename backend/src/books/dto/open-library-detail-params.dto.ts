import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';

export class OpenLibraryDetailParamsDto {
  @ApiProperty({
    enum: ['books', 'works'],
    example: 'works',
  })
  @IsIn(['books', 'works'])
  type!: 'books' | 'works';

  @ApiProperty({
    description: 'Open Library identifier without the leading path.',
    example: 'OL262758W',
  })
  @Matches(/^OL\d+[MW]$/)
  id!: string;
}
