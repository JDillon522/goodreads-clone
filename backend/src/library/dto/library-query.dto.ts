import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class LibraryQueryDto {
  @ApiPropertyOptional({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  shelfId?: string;
}
