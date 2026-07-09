import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { SessionStatusResponseDto } from './dto/session-status-response.dto';

/**
 * Provides a lightweight session-status endpoint for app startup guards. OwnerTokenGuard performs
 * the actual user-or-guest validation before this controller returns success.
 */
@ApiBearerAuth('bearer')
@ApiTags('Session')
@Controller('session')
@UseGuards(OwnerTokenGuard)
export class SessionController {
  /**
   * Confirms that the current bearer token resolved to a valid user or guest owner.
   */
  @Get('status')
  @ApiOperation({ summary: 'Validate the current user or guest app session.' })
  @ApiOkResponse({ type: SessionStatusResponseDto })
  public status(@CurrentOwner() owner: OwnerContext): SessionStatusResponseDto {
    return {
      authenticated: true,
      ownerType: owner.type === 'user' ? 'USER' : 'GUEST',
    };
  }
}
