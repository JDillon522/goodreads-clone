import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Overview: Defines the Library Query DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class LibraryQueryDto {
  @ApiPropertyOptional({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  shelfId?: string;
}
