import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { BooksService } from './books.service';
import { BookRelationsService } from './book-relations.service';
import { BookSearchQueryDto } from './dto/book-search-query.dto';
import { BookSearchResponseDto } from './dto/book-search-response.dto';
import { BookSeriesResponseDto } from './dto/book-series-response.dto';
import { BookMetadataResponseDto } from './dto/book-metadata-response.dto';
import { RelatedBooksQueryDto } from './dto/related-books-query.dto';
import { RelatedBooksResponseDto } from './dto/related-books-response.dto';
import { SimilarEditionsQueryDto } from './dto/similar-editions-query.dto';
import { SimilarEditionsResponseDto } from './dto/similar-editions-response.dto';

/**
 * Exposes Google-first search/detail endpoints with normalized Bookshelf response shapes.
 */
@ApiTags('Books')
@Controller('books')
export class BooksController {
  /**
   * Receives the book application and relation services from Nest.
   */
  public constructor(
    private readonly booksService: BooksService,
    private readonly bookRelationsService: BookRelationsService,
  ) {}

  /**
   * Fetches and normalizes a single Google Books volume.
   */
  @Get('google/:id')
  @ApiOperation({ summary: 'Fetch and normalize a Google Books volume.' })
  @ApiParam({ example: 'zyTCAlFPjgYC', name: 'id' })
  @ApiOkResponse({ type: BookMetadataResponseDto })
  @ApiBadRequestResponse({ description: 'The Google Books volume id is invalid.' })
  @ApiNotFoundResponse({ description: 'Google Books did not find the requested volume.' })
  @ApiTooManyRequestsResponse({ description: 'Google Books rate limit was reached.' })
  @ApiServiceUnavailableResponse({
    description: 'Google Books is unavailable or returned invalid data.',
  })
  public getGoogleBookDetail(@Param('id') id: string): Promise<BookMetadataResponseDto> {
    return this.booksService.getGoogleBookDetail(id);
  }

  /**
   * Searches Google Books with optional filters and pagination.
   */
  @Get('search')
  @ApiOperation({ summary: 'Search Google Books and return frontend-friendly book results.' })
  @ApiOkResponse({ type: BookSearchResponseDto })
  @ApiBadRequestResponse({ description: 'Search query, page, or limit is invalid.' })
  @ApiTooManyRequestsResponse({ description: 'Google Books rate limit was reached.' })
  @ApiServiceUnavailableResponse({
    description: 'Google Books is unavailable or returned invalid data.',
  })
  public searchBooks(@Query() query: BookSearchQueryDto): Promise<BookSearchResponseDto> {
    return this.booksService.searchBooks(query);
  }

  /**
   * Returns detected series metadata for a persisted shared book.
   */
  @Get(':id/series')
  @ApiOperation({ summary: 'Return detected series metadata for a persisted book.' })
  @ApiParam({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid', name: 'id' })
  @ApiOkResponse({ type: BookSeriesResponseDto })
  @ApiBadRequestResponse({ description: 'Book id is not a valid UUID.' })
  @ApiNotFoundResponse({ description: 'Book was not found.' })
  public getBookSeries(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookSeriesResponseDto> {
    return this.bookRelationsService.getSeries(id);
  }

  /**
   * Returns related persisted books for a shared book.
   */
  @Get(':id/related')
  @ApiOperation({ summary: 'Return related persisted books for a persisted book.' })
  @ApiParam({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid', name: 'id' })
  @ApiOkResponse({ type: RelatedBooksResponseDto })
  @ApiBadRequestResponse({ description: 'Book id or limit is invalid.' })
  @ApiNotFoundResponse({ description: 'Book was not found.' })
  public getRelatedBooks(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: RelatedBooksQueryDto,
  ): Promise<RelatedBooksResponseDto> {
    return this.bookRelationsService.getRelatedBooks(id, query.limit);
  }

  /**
   * Returns replaceable Google Books editions with the same or a closely matching title.
   */
  @Get(':id/similar-editions')
  @ApiOperation({ summary: 'Return similar Google Books editions for a persisted book.' })
  @ApiParam({ example: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5', format: 'uuid', name: 'id' })
  @ApiOkResponse({ type: SimilarEditionsResponseDto })
  @ApiBadRequestResponse({ description: 'Book id or limit is invalid.' })
  @ApiNotFoundResponse({ description: 'Book was not found.' })
  public getSimilarEditions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: SimilarEditionsQueryDto,
  ): Promise<SimilarEditionsResponseDto> {
    return this.bookRelationsService.getSimilarEditions(id, query.limit);
  }
}
