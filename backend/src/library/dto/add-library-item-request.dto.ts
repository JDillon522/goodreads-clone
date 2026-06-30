import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { BookInputDto } from './book-input.dto';

export class AddLibraryItemRequestDto {
  @ApiProperty({ type: BookInputDto })
  @ValidateNested()
  @Type(() => BookInputDto)
  book!: BookInputDto;

  @ApiPropertyOptional({
    description: 'Target shelf. Defaults to the user want-to-read shelf.',
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  shelfId?: string;
}
