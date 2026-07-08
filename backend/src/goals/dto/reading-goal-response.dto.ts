import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GoalStatsResponseDto } from './goal-stats-response.dto';

export class ReadingGoalResponseDto {
  @ApiPropertyOptional({
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  id!: null | string;

  @ApiProperty({ example: 2026 })
  year!: number;

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
