import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { userOwnerContext } from '../common/owner/owner-context';
import { ReadingGoalResponseDto } from './dto/reading-goal-response.dto';
import { UpdateReadingGoalRequestDto } from './dto/update-reading-goal-request.dto';
import { GoalsService } from './goals.service';

@ApiBearerAuth('bearer')
@ApiTags('Goals')
@Controller('goals')
@UseGuards(AccessTokenGuard)
export class GoalsController {
  public constructor(private readonly goalsService: GoalsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the current year reading goal and pace stats.' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public getCurrentGoal(@CurrentUser() user: AuthenticatedUser): Promise<ReadingGoalResponseDto> {
    return this.goalsService.getCurrentGoal(userOwnerContext(user.id));
  }

  @Get(':year')
  @ApiOperation({ summary: 'Get a reading goal and pace stats for a year.' })
  @ApiParam({ example: 2026, name: 'year' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public getGoalForYear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
  ): Promise<ReadingGoalResponseDto> {
    return this.goalsService.getGoalForYear(userOwnerContext(user.id), year);
  }

  @Put(':year')
  @ApiOperation({ summary: 'Create or replace a reading goal for a year.' })
  @ApiParam({ example: 2026, name: 'year' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public updateGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpdateReadingGoalRequestDto,
  ): Promise<ReadingGoalResponseDto> {
    return this.goalsService.updateGoal(userOwnerContext(user.id), year, dto);
  }
}
