import { ApiProperty } from '@nestjs/swagger';

import { ShelfSummaryResponseDto } from '../../library/dto/shelf-summary-response.dto';

/**
 * Overview: Defines the Deleted Shelf Book Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class DeletedShelfBookResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  libraryItemId!: string;

  @ApiProperty({ example: 'The Left Hand of Darkness' })
  title!: string;

  @ApiProperty({ isArray: true, type: ShelfSummaryResponseDto })
  shelves!: ShelfSummaryResponseDto[];
}
