import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { AddLibraryItemShelfRequestDto } from './dto/add-library-item-shelf-request.dto';
import { AddLibraryItemRequestDto } from './dto/add-library-item-request.dto';
import { LibraryItemResponseDto } from './dto/library-item-response.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { MoveLibraryItemRequestDto } from './dto/move-library-item-request.dto';
import { UpdateLibraryItemRequestDto } from './dto/update-library-item-request.dto';
import { UpdateProgressRequestDto } from './dto/update-progress-request.dto';
import { LibraryService } from './library.service';

/**
 * Exposes owner-scoped library item routes for users and guest sessions.
 */
@ApiBearerAuth('bearer')
@ApiTags('Library')
@Controller('library')
@UseGuards(OwnerTokenGuard)
export class LibraryController {
  /**
   * Receives the library application service from Nest.
   */
  public constructor(private readonly libraryService: LibraryService) {}
  /**
   * Adds an ISBN-backed book to the current owner's library.
   */
  @Post()
  @ApiOperation({ summary: 'Add an ISBN-backed book to the current owner library.' })
  @ApiCreatedResponse({ type: LibraryItemResponseDto })
  public addLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Body() dto: AddLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.addLibraryItem(owner, dto);
  }
  /**
   * Deletes one owned library item.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a library item.' })
  @ApiNoContentResponse()
  public async deleteLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
  ): Promise<void> {
    await this.libraryService.deleteLibraryItem(owner, libraryItemId);
  }
  /**
   * Lists owned library items, optionally filtered by shelf id.
   */
  @Get()
  @ApiOperation({ summary: 'List library items, optionally filtered by shelf.' })
  @ApiOkResponse({ type: LibraryItemResponseDto, isArray: true })
  public listLibraryItems(
    @CurrentOwner() owner: OwnerContext,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryItemResponseDto[]> {
    return this.libraryService.listLibraryItems(owner, query);
  }
  /**
   * Fetches one owned library item by id.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a library item by id.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public getLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.getLibraryItem(owner, libraryItemId);
  }
  /**
   * Updates editable detail fields such as rating, notes, and status.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update rating and notes for a library item.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public updateLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: UpdateLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.updateLibraryItem(owner, libraryItemId, dto);
  }
  /**
   * Legacy route that adds a shelf membership to a library item.
   */
  @Patch(':id/shelf')
  @ApiOperation({ summary: 'Add a shelf membership to a library item.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public moveLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: MoveLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.moveLibraryItem(owner, libraryItemId, dto);
  }
  /**
   * Adds a shelf membership to a library item.
   */
  @Post(':id/shelves')
  @ApiOperation({ summary: 'Add a shelf membership to a library item.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public addShelfToLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: AddLibraryItemShelfRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.addShelfToLibraryItem(owner, libraryItemId, dto);
  }

  /**
   * Removes a shelf membership and lets the service apply Unshelved fallback rules.
   */
  @Delete(':id/shelves/:shelfId')
  @ApiOperation({
    summary:
      'Remove a shelf membership from a library item, using Unshelved when it would otherwise have none.',
  })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public removeShelfFromLibraryItem(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.removeShelfFromLibraryItem(owner, libraryItemId, shelfId);
  }
  /**
   * Appends a reading progress entry and updates the current item snapshot.
   */
  @Post(':id/progress')
  @ApiOperation({ summary: 'Append a progress update and update completion state.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public updateProgress(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: UpdateProgressRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.updateProgress(owner, libraryItemId, dto);
  }
}
