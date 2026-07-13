import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BookSearchQueryDto } from '../books/dto/book-search-query.dto';
import { BookshelfCandidateService } from './bookshelf-candidate.service';
import { BookshelfImageService, maxBookshelfImageBytes } from './bookshelf-image.service';
import {
  BookshelfAnalysisResponseDto,
  BookshelfCandidateSearchResponseDto,
} from './dto/bookshelf-scan-response.dto';
import { GeminiBookshelfVisionService } from './gemini-bookshelf-vision.service';

/** Signed-in-only visual analysis and owner-aware candidate search. */
@ApiBearerAuth('bearer')
@ApiTags('Bookshelf scans')
@Controller('bookshelf-scans')
@UseGuards(AccessTokenGuard)
export class BookshelfScansController {
  public constructor(
    private readonly candidates: BookshelfCandidateService,
    private readonly images: BookshelfImageService,
    private readonly vision: GeminiBookshelfVisionService,
  ) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: maxBookshelfImageBytes } }))
  @ApiOperation({ summary: 'Analyze one bookshelf photo and resolve likely Google Books matches.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      properties: { image: { format: 'binary', type: 'string' } },
      required: ['image'],
      type: 'object',
    },
  })
  @ApiOkResponse({ type: BookshelfAnalysisResponseDto })
  @ApiBadRequestResponse({ description: 'The uploaded image is missing, invalid, or unsupported.' })
  @ApiUnauthorizedResponse({ description: 'A signed-in user access token is required.' })
  @ApiUnprocessableEntityResponse({ description: 'The image could not be analyzed safely.' })
  @ApiTooManyRequestsResponse({ description: 'The Gemini or Google Books rate limit was reached.' })
  @ApiServiceUnavailableResponse({ description: 'Image analysis is unavailable or misconfigured.' })
  public async analyze(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BookshelfAnalysisResponseDto> {
    const image = await this.images.validate(file);
    const observations = await this.vision.analyze(image);
    return this.candidates.buildAnalysis(user.id, this.vision.model, observations);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search Google Books and compare results with the signed-in library.' })
  @ApiOkResponse({ type: BookshelfCandidateSearchResponseDto })
  @ApiBadRequestResponse({ description: 'The manual search query is invalid.' })
  public search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookSearchQueryDto,
  ): Promise<BookshelfCandidateSearchResponseDto> {
    return this.candidates.search(user.id, query.query);
  }
}
