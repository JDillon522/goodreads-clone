import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LibraryItemStatus } from '@prisma/client';

import { GoalStatsResponseDto } from '../../goals/dto/goal-stats-response.dto';

export class StatsTotalsResponseDto {
  @ApiProperty({ example: 42 })
  totalLibraryBooks!: number;

  @ApiProperty({ example: 12 })
  booksCompleted!: number;

  @ApiProperty({ example: 3 })
  booksInProgress!: number;

  @ApiProperty({ example: 17 })
  booksWantToRead!: number;

  @ApiProperty({ example: 22 })
  booksReadAllTime!: number;

  @ApiProperty({ example: 4.2, nullable: true, type: Number })
  averageRating!: null | number;

  @ApiProperty({ example: 10 })
  ratedBooks!: number;

  @ApiProperty({ example: 27 })
  progressUpdates!: number;

  @ApiProperty({ example: 64 })
  activityEvents!: number;
}

export class StatsPageEstimateResponseDto {
  @ApiProperty({ example: 3400 })
  estimatedPagesRead!: number;

  @ApiProperty({ example: 3050 })
  knownCompletedPages!: number;

  @ApiProperty({ example: 2 })
  estimatedMissingPageBooks!: number;

  @ApiProperty({ example: 254 })
  averagePagesPerKnownCompletedBook!: number;

  @ApiProperty({ example: 620 })
  estimatedPagesInProgress!: number;
}

export class StatsMonthlyCompletionResponseDto {
  @ApiProperty({ example: 1, maximum: 12, minimum: 1 })
  month!: number;

  @ApiProperty({ example: 'Jan' })
  label!: string;

  @ApiProperty({ example: 2 })
  booksCompleted!: number;

  @ApiProperty({ example: 620 })
  estimatedPagesRead!: number;
}

export class StatsRankedValueResponseDto {
  @ApiProperty({ example: 'Fantasy' })
  name!: string;

  @ApiProperty({ example: 5 })
  count!: number;
}

export class StatsStatusBreakdownResponseDto {
  @ApiProperty({ enum: LibraryItemStatus, example: LibraryItemStatus.READ })
  status!: LibraryItemStatus;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class StatsShelfBreakdownResponseDto {
  @ApiProperty({
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  id!: null | string;

  @ApiProperty({ example: 'Read' })
  name!: string;

  @ApiProperty({ example: 'read' })
  slug!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class StatsBookHighlightResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiProperty({ example: 'Ursula K. Le Guin', nullable: true, type: String })
  primaryAuthor!: null | string;

  @ApiProperty({ example: 5, nullable: true, type: Number })
  rating!: null | number;

  @ApiProperty({ example: 304, nullable: true, type: Number })
  pageCount!: null | number;

  @ApiProperty({ example: 304 })
  estimatedPages!: number;

  @ApiProperty({
    example: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
    nullable: true,
    type: String,
  })
  coverUrl!: null | string;

  @ApiProperty({
    example: '2026-06-29T12:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  dateFinished!: null | string;
}

export class StatsGoalSummaryResponseDto {
  @ApiProperty({ example: 12 })
  targetBooks!: number;

  @ApiPropertyOptional({
    example: '2026-12-01T12:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  completedAt!: null | string;

  @ApiProperty({ type: GoalStatsResponseDto })
  stats!: GoalStatsResponseDto;
}

export class StatsSummaryResponseDto {
  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ example: '2026-07-08T12:00:00.000Z', format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: StatsTotalsResponseDto })
  totals!: StatsTotalsResponseDto;

  @ApiProperty({ type: StatsPageEstimateResponseDto })
  pages!: StatsPageEstimateResponseDto;

  @ApiProperty({ type: StatsGoalSummaryResponseDto })
  goal!: StatsGoalSummaryResponseDto;

  @ApiProperty({ isArray: true, type: StatsMonthlyCompletionResponseDto })
  monthlyCompletions!: StatsMonthlyCompletionResponseDto[];

  @ApiProperty({ isArray: true, type: StatsRankedValueResponseDto })
  genres!: StatsRankedValueResponseDto[];

  @ApiProperty({ isArray: true, type: StatsRankedValueResponseDto })
  authors!: StatsRankedValueResponseDto[];

  @ApiProperty({ isArray: true, type: StatsStatusBreakdownResponseDto })
  statuses!: StatsStatusBreakdownResponseDto[];

  @ApiProperty({ isArray: true, type: StatsShelfBreakdownResponseDto })
  shelves!: StatsShelfBreakdownResponseDto[];

  @ApiProperty({ isArray: true, type: StatsBookHighlightResponseDto })
  topRatedBooks!: StatsBookHighlightResponseDto[];

  @ApiProperty({ nullable: true, type: StatsBookHighlightResponseDto })
  longestCompletedBook!: null | StatsBookHighlightResponseDto;
}
