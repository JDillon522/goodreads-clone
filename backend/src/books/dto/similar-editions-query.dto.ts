import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query controls for the compact similar-editions section on book detail. */
export class SimilarEditionsQueryDto {
  @IsInt()
  @IsOptional()
  @Max(12)
  @Min(1)
  @Type(() => Number)
  limit = 6;
}
