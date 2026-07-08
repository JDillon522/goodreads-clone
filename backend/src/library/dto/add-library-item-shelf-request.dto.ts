import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddLibraryItemShelfRequestDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  @IsUUID('4')
  shelfId!: string;
}
