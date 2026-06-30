import { ApiProperty } from '@nestjs/swagger';

export class GoalStatsResponseDto {
  @ApiProperty({ example: 6 })
  completedBooks!: number;

  @ApiProperty({ example: 6 })
  remainingBooks!: number;

  @ApiProperty({ example: 50 })
  percentComplete!: number;

  @ApiProperty({ example: 181 })
  daysElapsed!: number;

  @ApiProperty({ example: 184 })
  daysRemaining!: number;

  @ApiProperty({ example: 5.95 })
  expectedCompletedByToday!: number;

  @ApiProperty({ example: true })
  isOnTrack!: boolean;

  @ApiProperty({ example: 0 })
  booksBehindPace!: number;
}
