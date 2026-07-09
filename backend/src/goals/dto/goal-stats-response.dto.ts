import { ApiProperty } from '@nestjs/swagger';

/**
 * Overview: Defines the Goal Stats Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
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

  @ApiProperty({ example: false })
  isComplete!: boolean;

  @ApiProperty({ example: 0 })
  booksBehindPace!: number;
}
