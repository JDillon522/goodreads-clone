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
import { NormalizedBookDto } from './dto/normalized-book.dto';
import { OpenLibraryDetailParamsDto } from './dto/open-library-detail-params.dto';
import { RelatedBooksQueryDto } from './dto/related-books-query.dto';
import { RelatedBooksResponseDto } from './dto/related-books-response.dto';

/**
 * Exposes Open Library search and detail endpoints with normalized Bookshelf response shapes.
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
   * Fetches and normalizes a single Open Library work or edition.
   */
  @Get('open-library/:type/:id')
  @ApiOperation({ summary: 'Fetch and normalize an Open Library work or edition.' })
  @ApiParam({ enum: ['books', 'works'], name: 'type' })
  @ApiParam({ example: 'OL262758W', name: 'id' })
  @ApiOkResponse({ type: NormalizedBookDto })
  @ApiBadRequestResponse({ description: 'The Open Library type/id pair is invalid.' })
  @ApiNotFoundResponse({ description: 'Open Library did not find the requested book.' })
  @ApiTooManyRequestsResponse({ description: 'Open Library rate limit was reached.' })
  @ApiServiceUnavailableResponse({
    description: 'Open Library is unavailable or returned invalid data.',
  })
  public getOpenLibraryDetail(
    @Param() params: OpenLibraryDetailParamsDto,
  ): Promise<NormalizedBookDto> {
    return this.booksService.getOpenLibraryDetail(params.type, params.id);
  }

  /**
   * Searches Open Library with optional filters and pagination.
   */
  @Get('search')
  @ApiOperation({ summary: 'Search Open Library and return frontend-friendly book results.' })
  @ApiOkResponse({ type: BookSearchResponseDto })
  @ApiBadRequestResponse({ description: 'Search query, page, or limit is invalid.' })
  @ApiTooManyRequestsResponse({ description: 'Open Library rate limit was reached.' })
  @ApiServiceUnavailableResponse({
    description: 'Open Library is unavailable or returned invalid data.',
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
}
