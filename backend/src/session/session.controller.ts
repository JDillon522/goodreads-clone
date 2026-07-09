import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { SessionStatusResponseDto } from './dto/session-status-response.dto';

@ApiBearerAuth('bearer')
@ApiTags('Session')
@Controller('session')
@UseGuards(OwnerTokenGuard)
export class SessionController {
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
