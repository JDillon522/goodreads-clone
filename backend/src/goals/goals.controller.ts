import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { ReadingGoalResponseDto } from './dto/reading-goal-response.dto';
import { UpdateReadingGoalRequestDto } from './dto/update-reading-goal-request.dto';
import { GoalsService } from './goals.service';

@ApiBearerAuth('bearer')
@ApiTags('Goals')
@Controller('goals')
@UseGuards(OwnerTokenGuard)
export class GoalsController {
  public constructor(private readonly goalsService: GoalsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the current year reading goal and pace stats.' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public getCurrentGoal(@CurrentOwner() owner: OwnerContext): Promise<ReadingGoalResponseDto> {
    return this.goalsService.getCurrentGoal(owner);
  }

  @Get(':year')
  @ApiOperation({ summary: 'Get a reading goal and pace stats for a year.' })
  @ApiParam({ example: 2026, name: 'year' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public getGoalForYear(
    @CurrentOwner() owner: OwnerContext,
    @Param('year', ParseIntPipe) year: number,
  ): Promise<ReadingGoalResponseDto> {
    return this.goalsService.getGoalForYear(owner, year);
  }

  @Put(':year')
  @ApiOperation({ summary: 'Create or replace a reading goal for a year.' })
  @ApiParam({ example: 2026, name: 'year' })
  @ApiOkResponse({ type: ReadingGoalResponseDto })
  public updateGoal(
    @CurrentOwner() owner: OwnerContext,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpdateReadingGoalRequestDto,
  ): Promise<ReadingGoalResponseDto> {
    return this.goalsService.updateGoal(owner, year, dto);
  }
}
