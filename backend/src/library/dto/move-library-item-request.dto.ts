import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Overview: Defines the Move Library Item Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class MoveLibraryItemRequestDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  @IsUUID('4')
  shelfId!: string;
}
