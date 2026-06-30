import { ApiProperty } from '@nestjs/swagger';

export class ShelfSummaryResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Want to Read' })
  name!: string;

  @ApiProperty({ example: 'want-to-read' })
  slug!: string;

  @ApiProperty({ example: 0 })
  position!: number;
}
