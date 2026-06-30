import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateShelfRequestDto {
  @ApiProperty({ example: 'Favorites', maxLength: 80, minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}
