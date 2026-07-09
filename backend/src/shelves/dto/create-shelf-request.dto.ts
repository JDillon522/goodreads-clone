import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Overview: Defines the Create Shelf Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class CreateShelfRequestDto {
  @ApiProperty({ example: 'Favorites', maxLength: 80, minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
