import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StatsSummaryQueryDto {
  @ApiPropertyOptional({ example: 2026, maximum: 3000, minimum: 1900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(3000)
  year?: number;
}
