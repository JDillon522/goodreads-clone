import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookshelfPhotoKind } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { BookSummaryDto } from '../../books/dto/book-metadata-response.dto';
import { BookshelfBoundingBoxDto } from './bookshelf-scan-response.dto';

/** Multipart fields used only after a user explicitly chooses to retain a photo. */
export class SaveBookshelfPhotoUploadDto {
  @ApiProperty({ format: 'binary', type: 'string' })
  @IsOptional()
  image!: unknown;

  @ApiPropertyOptional({ example: 'Office case, middle shelf', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiProperty({ description: 'JSON-encoded reviewed detection manifest.', type: String })
  @IsNotEmpty()
  @IsString()
  manifest!: string;
}

export class UpdateBookshelfPhotoRequestDto {
  @ApiProperty({ example: 'Office case, middle shelf', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  label!: string;
}

export class AssociateBookshelfDetectionRequestDto {
  @ApiPropertyOptional({ example: 'zyTCAlFPjgYC', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  googleBooksVolumeId?: null | string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsString()
  libraryItemId?: null | string;
}

export class BookshelfPhotoSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Office case, middle shelf' })
  label!: string;

  @ApiProperty({ enum: BookshelfPhotoKind, example: BookshelfPhotoKind.SHELF })
  kind!: BookshelfPhotoKind;

  @ApiProperty({ example: 4032 })
  imageWidth!: number;

  @ApiProperty({ example: 3024 })
  imageHeight!: number;

  @ApiProperty({ example: 18 })
  detectionCount!: number;

  @ApiProperty({ example: 14 })
  associatedDetectionCount!: number;

  @ApiProperty({ example: '2026-07-12T12:00:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-12T12:00:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class BookshelfDetectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({ example: 'THE LEFT HAND OF DARKNESS — URSULA K. LE GUIN' })
  observedSpineText!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  observedTitle!: null | string;

  @ApiProperty({ isArray: true, type: String })
  observedAuthors!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  observedPublisher!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  observedIsbn10!: null | string;

  @ApiPropertyOptional({ nullable: true, type: String })
  observedIsbn13!: null | string;

  @ApiProperty({ maximum: 100, minimum: 0 })
  confidence!: number;

  @ApiProperty({ type: BookshelfBoundingBoxDto })
  boundingBox!: BookshelfBoundingBoxDto;

  @ApiPropertyOptional({ nullable: true, type: String })
  selectedGoogleBooksVolumeId!: null | string;

  @ApiPropertyOptional({ nullable: true, type: BookSummaryDto })
  selectedBook!: BookSummaryDto | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  libraryItemId!: null | string;
}

export class BookshelfPhotoDetailDto extends BookshelfPhotoSummaryDto {
  @ApiProperty({ isArray: true, type: BookshelfDetectionResponseDto })
  detections!: BookshelfDetectionResponseDto[];
}

/** One saved physical location for a library item. */
export class BookshelfBookLocationDto {
  @ApiProperty({ format: 'uuid' })
  detectionId!: string;

  @ApiProperty({ format: 'uuid' })
  photoId!: string;

  @ApiProperty({ example: 'Office case, middle shelf' })
  photoLabel!: string;

  @ApiProperty({ example: 4032 })
  imageWidth!: number;

  @ApiProperty({ example: 3024 })
  imageHeight!: number;

  @ApiProperty({ example: 4 })
  position!: number;

  @ApiProperty({ type: BookshelfBoundingBoxDto })
  boundingBox!: BookshelfBoundingBoxDto;

  @ApiProperty({ example: '2026-07-12T12:00:00.000Z', format: 'date-time' })
  photoCreatedAt!: string;
}
