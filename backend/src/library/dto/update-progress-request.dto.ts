import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressTrackingMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Overview: Defines the Update Progress Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class UpdateProgressRequestDto {
  @ApiProperty({ enum: ProgressTrackingMode, example: ProgressTrackingMode.PAGE })
  @IsEnum(ProgressTrackingMode)
  trackingMode!: ProgressTrackingMode;

  @ApiPropertyOptional({ example: 152, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  currentPage?: number;

  @ApiPropertyOptional({ example: 50, maximum: 100, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  currentPercent?: number;
}
