import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Identifies the library item and cover snapshot that produced the active custom palette.
 */
export class ThemePaletteSourceDto {
  @ApiPropertyOptional({
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  libraryItemId!: null | string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiProperty({
    example:
      'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiProperty({ example: '2026-07-09T12:00:00.000Z', format: 'date-time' })
  generatedAt!: string;
}
