import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Overview: Defines the Update Reading Goal Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class UpdateReadingGoalRequestDto {
  @ApiProperty({ example: 12, maximum: 999, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  targetBooks!: number;
}
