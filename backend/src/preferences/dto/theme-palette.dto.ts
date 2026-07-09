import { ApiProperty } from '@nestjs/swagger';

import { ThemePaletteTokenSetDto } from './theme-palette-token-set.dto';

/**
 * Overview: Defines the paired light/dark palette payload generated from one book cover.
 */
export class ThemePaletteDto {
  @ApiProperty({ type: ThemePaletteTokenSetDto })
  light!: ThemePaletteTokenSetDto;

  @ApiProperty({ type: ThemePaletteTokenSetDto })
  dark!: ThemePaletteTokenSetDto;
}
