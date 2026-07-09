import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Overview: Defines the Update Shelf Order Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class UpdateShelfOrderRequestDto {
  @ApiProperty({
    example: ['5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', '2148a988-11c3-48f8-bc65-f2a426be242f'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  shelfIds!: string[];
}
