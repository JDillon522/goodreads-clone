import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GuestSessionResponseDto } from './dto/guest-session-response.dto';
import { GuestService } from './guest.service';

@ApiTags('Guest')
@Controller('guest')
export class GuestController {
  public constructor(private readonly guestService: GuestService) {}

  @Post('session')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a temporary guest session with seeded demo library data.',
  })
  @ApiCreatedResponse({ type: GuestSessionResponseDto })
  public createSession(): Promise<GuestSessionResponseDto> {
    return this.guestService.createSession();
  }
}
