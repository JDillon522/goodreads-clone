import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { StatsSummaryQueryDto } from './dto/stats-summary-query.dto';
import { StatsSummaryResponseDto } from './dto/stats-summary-response.dto';
import { YearInReviewResponseDto } from './dto/year-in-review-response.dto';
import { StatsService } from './stats.service';

/**
 * Exposes owner-scoped reading statistics and year-in-review endpoints.
 */
@ApiBearerAuth('bearer')
@ApiTags('Stats')
@Controller('stats')
@UseGuards(OwnerTokenGuard)
export class StatsController {
  /**
   * Receives the stats application service from Nest.
   */
  public constructor(private readonly statsService: StatsService) {}
  /**
   * Returns dashboard statistics for a year, defaulting to the current year.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Get reading statistics for a year.' })
  @ApiOkResponse({ type: StatsSummaryResponseDto })
  public getSummary(
    @CurrentOwner() owner: OwnerContext,
    @Query() query: StatsSummaryQueryDto,
  ): Promise<StatsSummaryResponseDto> {
    return this.statsService.getSummary(owner, query.year);
  }
  /**
   * Returns year-in-review highlights and summary metrics for the requested year.
   */
  @Get('year-in-review/:year')
  @ApiOperation({ summary: 'Get year-in-review highlights and statistics.' })
  @ApiParam({ example: 2026, name: 'year' })
  @ApiOkResponse({ type: YearInReviewResponseDto })
  public getYearInReview(
    @CurrentOwner() owner: OwnerContext,
    @Param('year', ParseIntPipe) year: number,
  ): Promise<YearInReviewResponseDto> {
    return this.statsService.getYearInReview(owner, year);
  }
}
