import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { BookMetadataResponseDto } from '../../books/dto/book-metadata-response.dto';
import { LibraryItemResponseDto } from '../../library/dto/library-item-response.dto';

export const bookshelfCandidateClassifications = [
  'DIFFERENT_EDITION',
  'EXACT_EDITION',
  'NEEDS_REVIEW',
  'NEW',
] as const;

export type BookshelfCandidateClassification = (typeof bookshelfCandidateClassifications)[number];

export const bookshelfProviderIssueCodes = ['RATE_LIMITED', 'UNAVAILABLE'] as const;
export type BookshelfProviderIssueCode = (typeof bookshelfProviderIssueCodes)[number];

/** A provider problem encountered after visual extraction while resolving editions. */
export class BookshelfProviderIssueDto {
  @ApiProperty({ enum: ['GOOGLE_BOOKS'], example: 'GOOGLE_BOOKS' })
  provider!: 'GOOGLE_BOOKS';

  @ApiProperty({ enum: bookshelfProviderIssueCodes, example: 'UNAVAILABLE' })
  code!: BookshelfProviderIssueCode;

  @ApiProperty({ example: 'Google Books is temporarily unavailable. Some matches need review.' })
  message!: string;
}

/** Normalized image coordinates use a provider-independent 0-1000 canvas. */
export class BookshelfBoundingBoxDto {
  @ApiProperty({ example: 125, maximum: 1000, minimum: 0 })
  x!: number;

  @ApiProperty({ example: 80, maximum: 1000, minimum: 0 })
  y!: number;

  @ApiProperty({ example: 72, maximum: 1000, minimum: 1 })
  width!: number;

  @ApiProperty({ example: 760, maximum: 1000, minimum: 1 })
  height!: number;

  @ApiProperty({ example: 0, maximum: 180, minimum: -180 })
  rotationDegrees!: number;
}

/** One authoritative Google Books candidate plus its relationship to the current library. */
export class BookshelfCandidateDto {
  @ApiProperty({ type: BookMetadataResponseDto })
  book!: BookMetadataResponseDto;

  @ApiProperty({ enum: bookshelfCandidateClassifications, example: 'NEW' })
  classification!: BookshelfCandidateClassification;

  @ApiProperty({ example: 91, maximum: 100, minimum: 0 })
  matchScore!: number;

  @ApiProperty({ isArray: true, type: LibraryItemResponseDto })
  libraryMatches!: LibraryItemResponseDto[];
}

/** One client-initiated request to resolve a visual observation through Google Books. */
export class BookshelfCandidateMatchRequestDto {
  @ApiProperty({ example: '77aa72ca-b879-4ea6-8b29-e702f0f10f3b', format: 'uuid' })
  @IsUUID('4')
  detectionId!: string;

  @ApiProperty({ example: 'THE LEFT HAND OF DARKNESS — URSULA K. LE GUIN' })
  @IsString()
  @MaxLength(1000)
  observedSpineText!: string;

  @ApiPropertyOptional({ example: 'The Left Hand of Darkness', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observedTitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  observedAuthors!: string[];

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observedPublisher!: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  observedIsbn10!: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  observedIsbn13!: null | string;
}

/** Candidate matches for exactly one visual detection. */
export class BookshelfCandidateMatchResponseDto {
  @ApiProperty({ example: '77aa72ca-b879-4ea6-8b29-e702f0f10f3b', format: 'uuid' })
  detectionId!: string;

  @ApiProperty({ isArray: true, type: BookshelfCandidateDto })
  candidates!: BookshelfCandidateDto[];
}

/** Text and coordinates extracted from one visible book spine. */
export class BookshelfScanDetectionDto {
  @ApiProperty({ example: '77aa72ca-b879-4ea6-8b29-e702f0f10f3b', format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({ example: 'THE LEFT HAND OF DARKNESS — URSULA K. LE GUIN' })
  observedSpineText!: string;

  @ApiPropertyOptional({ example: 'The Left Hand of Darkness', nullable: true, type: String })
  observedTitle!: null | string;

  @ApiProperty({ example: ['Ursula K. Le Guin'], isArray: true, type: String })
  observedAuthors!: string[];

  @ApiPropertyOptional({ example: 'Ace Books', nullable: true, type: String })
  observedPublisher!: null | string;

  @ApiPropertyOptional({ example: '0441478123', nullable: true, type: String })
  observedIsbn10!: null | string;

  @ApiPropertyOptional({ example: '9780441478125', nullable: true, type: String })
  observedIsbn13!: null | string;

  @ApiProperty({ example: 88, maximum: 100, minimum: 0 })
  confidence!: number;

  @ApiProperty({ type: BookshelfBoundingBoxDto })
  boundingBox!: BookshelfBoundingBoxDto;

  @ApiProperty({ isArray: true, type: BookshelfCandidateDto })
  candidates!: BookshelfCandidateDto[];
}

/** Ephemeral visual result returned before client-initiated Google Books matching. */
export class BookshelfAnalysisResponseDto {
  @ApiProperty({ isArray: true, type: BookshelfScanDetectionDto })
  detections!: BookshelfScanDetectionDto[];

  @ApiProperty({ example: 'gemini-3.5-flash' })
  model!: string;

  @ApiProperty({ example: 8 })
  count!: number;

  @ApiProperty({ isArray: true, type: BookshelfProviderIssueDto })
  providerIssues!: BookshelfProviderIssueDto[];
}

/** Owner-aware manual Google search results use the same comparison shape as analysis. */
export class BookshelfCandidateSearchResponseDto {
  @ApiProperty({ example: 'the left hand of darkness ursula le guin' })
  query!: string;

  @ApiProperty({ isArray: true, type: BookshelfCandidateDto })
  items!: BookshelfCandidateDto[];
}
