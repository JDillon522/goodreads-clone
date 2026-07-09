import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

/**
 * Overview: Accepts partial theme preference updates. `customBook` mode requires the owned library
 * item id whose cover should generate the palette.
 */
export class UpdateThemePreferenceRequestDto {
  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'], example: 'dark' })
  @IsOptional()
  @IsIn(['dark', 'light', 'system'])
  theme?: 'dark' | 'light' | 'system';

  @ApiPropertyOptional({ enum: ['default', 'autoTopBook', 'customBook'], example: 'customBook' })
  @IsOptional()
  @IsIn(['autoTopBook', 'customBook', 'default'])
  paletteMode?: 'autoTopBook' | 'customBook' | 'default';

  @ApiPropertyOptional({
    description: 'Required when paletteMode is customBook.',
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
  })
  @ValidateIf((dto: UpdateThemePreferenceRequestDto) => dto.paletteMode === 'customBook')
  @IsUUID('4')
  libraryItemId?: string;
}
