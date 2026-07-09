import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Overview: Defines the Update Shelf Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class UpdateShelfRequestDto {
  @ApiPropertyOptional({ example: 'Favorites', maxLength: 80, minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
}
