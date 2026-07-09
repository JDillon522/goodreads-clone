import { Controller, Get, Param, Query } from '@nestjs/common';
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
import { BookSearchQueryDto } from './dto/book-search-query.dto';
import { BookSearchResponseDto } from './dto/book-search-response.dto';
import { NormalizedBookDto } from './dto/normalized-book.dto';
import { OpenLibraryDetailParamsDto } from './dto/open-library-detail-params.dto';

/**
 * Exposes Open Library search and detail endpoints with normalized Bookshelf response shapes.
 */
@ApiTags('Books')
@Controller('books')
export class BooksController {
  /**
   * Receives the book application service from Nest.
   */
  public constructor(private readonly booksService: BooksService) {}

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
}
