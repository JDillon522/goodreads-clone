import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateLibraryItemRequestDto {
  @ApiPropertyOptional({
    description: 'Set a 1-5 rating or null to clear it.',
    example: 5,
    maximum: 5,
    minimum: 1,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: null | number;

  @ApiPropertyOptional({
    description: 'Set plain-text notes or null to clear them.',
    example: 'Loved the worldbuilding.',
    maxLength: 5000,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: null | string;
}
