import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the exact CSS custom properties a generated book palette is allowed to
 * override. Keeping this contract explicit protects text tokens from cover art while allowing
 * controlled background and surface tinting.
 */
export class ThemePaletteTokenSetDto {
  @ApiProperty({ example: '#eef6f4' })
  '--color-bg-primary'!: string;

  @ApiProperty({ example: '#dcecea' })
  '--color-bg-secondary'!: string;

  @ApiProperty({ example: '#d3e2dd' })
  '--color-bg-tertiary'!: string;

  @ApiProperty({ example: '#fafdfe' })
  '--color-surface'!: string;

  @ApiProperty({ example: '#fbfcfa' })
  '--color-surface-raised'!: string;

  @ApiProperty({ example: '#bfd4d7' })
  '--color-border'!: string;

  @ApiProperty({ example: '#d7e6e7' })
  '--color-border-subtle'!: string;

  @ApiProperty({ example: '#167f9f' })
  '--color-accent'!: string;

  @ApiProperty({ example: '#0e5f79' })
  '--color-accent-hover'!: string;

  @ApiProperty({ example: '#dff3f8' })
  '--color-accent-subtle'!: string;

  @ApiProperty({ example: '#eef9fb' })
  '--color-accent-muted'!: string;

  @ApiProperty({ example: '#ffffff' })
  '--color-on-accent'!: string;

  @ApiProperty({ example: 'rgba(22, 127, 159, 0.24)' })
  '--color-focus-ring'!: string;

  @ApiProperty({ example: '#d99a19' })
  '--color-highlight'!: string;

  @ApiProperty({ example: '#fff3d6' })
  '--color-highlight-subtle'!: string;

  @ApiProperty({ example: '#1d1200' })
  '--color-on-highlight'!: string;

  @ApiProperty({ example: '#167f9f' })
  '--color-progress'!: string;

  @ApiProperty({ example: '#d99a19' })
  '--color-rating'!: string;
}
