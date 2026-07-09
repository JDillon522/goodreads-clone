import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Overview: Defines the Shelf Response DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class ShelfResponseDto {
  @ApiProperty({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Want to Read' })
  name!: string;

  @ApiProperty({ example: 'want-to-read' })
  slug!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: 12 })
  itemCount!: number;

  @ApiPropertyOptional({ example: null, format: 'date-time', nullable: true, type: String })
  deactivatedAt!: null | string;

  @ApiProperty({ example: '2026-06-29T12:00:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-29T12:00:00.000Z', format: 'date-time' })
  updatedAt!: string;
}
