import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Overview: Defines the Add Library Item Request DTO contract so validation and Swagger metadata stay readable around annotation-heavy fields.
 */
export class AddLibraryItemRequestDto {
  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn10?: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn13?: null | string;

  @ApiPropertyOptional({
    description:
      'Google Books volume id from search/detail, used to warm the shared metadata cache.',
    example: 'zyTCAlFPjgYC',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  googleBooksVolumeId?: null | string;

  @ApiPropertyOptional({
    description: 'Initial target shelf membership. Defaults to the owner Unshelved shelf.',
    example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  shelfId?: string;
}
