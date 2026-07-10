import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Overview: Query controls for related-book lookups, kept small because relations are rendered as
 * compact detail-page enrichment rather than a searchable catalog.
 */
export class RelatedBooksQueryDto {
  @ApiPropertyOptional({ default: 12, example: 12, maximum: 24, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit: number = 12;
}
