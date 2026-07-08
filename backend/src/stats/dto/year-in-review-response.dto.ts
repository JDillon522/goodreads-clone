import { ApiProperty } from '@nestjs/swagger';

import {
  StatsBookHighlightResponseDto,
  StatsMonthlyCompletionResponseDto,
  StatsRankedValueResponseDto,
  StatsSummaryResponseDto,
} from './stats-summary-response.dto';

export class YearInReviewHighlightsResponseDto {
  @ApiProperty({ example: true })
  hasCompletedBooks!: boolean;

  @ApiProperty({ nullable: true, type: StatsRankedValueResponseDto })
  topGenre!: null | StatsRankedValueResponseDto;

  @ApiProperty({ nullable: true, type: StatsRankedValueResponseDto })
  topAuthor!: null | StatsRankedValueResponseDto;

  @ApiProperty({ nullable: true, type: StatsBookHighlightResponseDto })
  topRatedBook!: null | StatsBookHighlightResponseDto;

  @ApiProperty({ nullable: true, type: StatsBookHighlightResponseDto })
  longestBook!: null | StatsBookHighlightResponseDto;

  @ApiProperty({ nullable: true, type: StatsMonthlyCompletionResponseDto })
  bestMonth!: null | StatsMonthlyCompletionResponseDto;
}

export class YearInReviewResponseDto {
  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: '2026-07-08T12:00:00.000Z', format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: StatsSummaryResponseDto })
  summary!: StatsSummaryResponseDto;

  @ApiProperty({ type: YearInReviewHighlightsResponseDto })
  highlights!: YearInReviewHighlightsResponseDto;
}
