import { ApiProperty } from '@nestjs/swagger';

import { ThemePaletteDto } from './theme-palette.dto';
import { ThemePaletteSourceDto } from './theme-palette-source.dto';

/**
 * Overview: Returns the current owner theme settings, including the base light/dark/system choice
 * and any book-cover palette layered over that base theme.
 */
export class ThemePreferenceResponseDto {
  @ApiProperty({ enum: ['light', 'dark', 'system'], example: 'system' })
  theme!: 'dark' | 'light' | 'system';

  @ApiProperty({ enum: ['default', 'autoTopBook', 'customBook'], example: 'customBook' })
  paletteMode!: 'autoTopBook' | 'customBook' | 'default';

  @ApiProperty({ nullable: true, type: ThemePaletteDto })
  palette!: null | ThemePaletteDto;

  @ApiProperty({ nullable: true, type: ThemePaletteSourceDto })
  source!: null | ThemePaletteSourceDto;
}
