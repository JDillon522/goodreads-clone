import { ApiProperty } from '@nestjs/swagger';

import { DeletedShelfBookResponseDto } from './deleted-shelf-book-response.dto';

/**
 * Overview: Defines the Delete Shelf Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class DeleteShelfResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  deletedShelfId!: string;

  @ApiProperty({ example: 'SciFi' })
  deletedShelfName!: string;

  @ApiProperty({
    description: 'Created or reused fallback shelf id when books would otherwise have no shelf.',
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  fallbackShelfId!: null | string;

  @ApiProperty({ isArray: true, type: DeletedShelfBookResponseDto })
  affectedBooks!: DeletedShelfBookResponseDto[];
}
