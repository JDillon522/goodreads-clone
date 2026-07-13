import type { Response } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BookshelfImageService, maxBookshelfImageBytes } from './bookshelf-image.service';
import { BookshelfPhotoService } from './bookshelf-photo.service';
import {
  AssociateBookshelfDetectionRequestDto,
  BookshelfDetectionResponseDto,
  BookshelfPhotoDetailDto,
  BookshelfPhotoSummaryDto,
  SaveBookshelfPhotoUploadDto,
  UpdateBookshelfPhotoRequestDto,
} from './dto/bookshelf-photo.dto';

/** Owner-scoped storage and management for explicitly saved shelf photographs. */
@ApiBearerAuth('bearer')
@ApiTags('Bookshelf photos')
@Controller('bookshelf-photos')
@UseGuards(AccessTokenGuard)
export class BookshelfPhotosController {
  public constructor(
    private readonly images: BookshelfImageService,
    private readonly photos: BookshelfPhotoService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: maxBookshelfImageBytes } }))
  @ApiOperation({ summary: 'Explicitly save a reviewed bookshelf photo and detection manifest.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SaveBookshelfPhotoUploadDto })
  @ApiOkResponse({ type: BookshelfPhotoDetailDto })
  public async save(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SaveBookshelfPhotoUploadDto,
  ): Promise<BookshelfPhotoDetailDto> {
    const image = await this.images.prepareForStorage(file);
    return this.photos.save(user.id, image, body.label, body.manifest);
  }

  @Get()
  @ApiOperation({ summary: 'List saved bookshelf photos without returning binary image data.' })
  @ApiOkResponse({ isArray: true, type: BookshelfPhotoSummaryDto })
  public list(@CurrentUser() user: AuthenticatedUser): Promise<BookshelfPhotoSummaryDto[]> {
    return this.photos.list(user.id);
  }

  @Get(':id/image')
  @ApiOperation({ summary: 'Return the authenticated owner’s original bookshelf image.' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ schema: { format: 'binary', type: 'string' } })
  public async image(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const image = await this.photos.image(user.id, id, false);
    setPrivateImageHeaders(response, image.mimeType);
    return image.data;
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: 'Return the authenticated owner’s bookshelf gallery thumbnail.' })
  @ApiProduces('image/webp')
  @ApiOkResponse({ schema: { format: 'binary', type: 'string' } })
  public async thumbnail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const image = await this.photos.image(user.id, id, true);
    setPrivateImageHeaders(response, image.mimeType);
    return image.data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one saved bookshelf photo and its reviewed detections.' })
  @ApiOkResponse({ type: BookshelfPhotoDetailDto })
  @ApiNotFoundResponse({ description: 'The photo is missing or belongs to another user.' })
  public get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<BookshelfPhotoDetailDto> {
    return this.photos.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename one saved bookshelf photo.' })
  @ApiOkResponse({ type: BookshelfPhotoDetailDto })
  public rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateBookshelfPhotoRequestDto,
  ): Promise<BookshelfPhotoDetailDto> {
    return this.photos.rename(user.id, id, body.label);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one saved bookshelf photo and all of its detections.' })
  @ApiNoContentResponse()
  public delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.photos.delete(user.id, id);
  }

  @Patch(':photoId/detections/:detectionId')
  @ApiOperation({ summary: 'Associate or clear one saved spine detection.' })
  @ApiOkResponse({ type: BookshelfDetectionResponseDto })
  public associate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId', new ParseUUIDPipe({ version: '4' })) photoId: string,
    @Param('detectionId', new ParseUUIDPipe({ version: '4' })) detectionId: string,
    @Body() body: AssociateBookshelfDetectionRequestDto,
  ): Promise<BookshelfDetectionResponseDto> {
    return this.photos.associate(user.id, photoId, detectionId, body);
  }
}

function setPrivateImageHeaders(response: Response, mimeType: string): void {
  response.setHeader('Cache-Control', 'private, max-age=300');
  response.setHeader('Content-Type', mimeType);
  response.setHeader('X-Content-Type-Options', 'nosniff');
}
