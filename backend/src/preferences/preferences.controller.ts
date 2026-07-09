import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UpdateThemePreferenceRequestDto } from './dto/update-theme-preference-request.dto';
import { PreferencesService } from './preferences.service';

/**
 * Exposes owner-scoped preference routes for the app theme system.
 */
@ApiBearerAuth('bearer')
@ApiTags('Preferences')
@Controller('preferences')
@UseGuards(OwnerTokenGuard)
export class PreferencesController {
  /**
   * Receives the preference application service from Nest.
   */
  public constructor(private readonly preferencesService: PreferencesService) {}
  /**
   * Returns the active base theme and any generated book-cover palette.
   */
  @Get('theme')
  @ApiOperation({ summary: 'Get theme preferences for the current owner.' })
  @ApiOkResponse({ type: ThemePreferenceResponseDto })
  public getThemePreference(
    @CurrentOwner() owner: OwnerContext,
  ): Promise<ThemePreferenceResponseDto> {
    return this.preferencesService.getThemePreference(owner);
  }
  /**
   * Updates the base theme or palette source for the current owner.
   */
  @Put('theme')
  @ApiOperation({ summary: 'Update theme preferences for the current owner.' })
  @ApiOkResponse({ type: ThemePreferenceResponseDto })
  public updateThemePreference(
    @CurrentOwner() owner: OwnerContext,
    @Body() dto: UpdateThemePreferenceRequestDto,
  ): Promise<ThemePreferenceResponseDto> {
    return this.preferencesService.updateThemePreference(owner, dto);
  }
}
