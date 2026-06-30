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

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { userOwnerContext } from '../common/owner/owner-context';
import { AddLibraryItemRequestDto } from './dto/add-library-item-request.dto';
import { LibraryItemResponseDto } from './dto/library-item-response.dto';
import { LibraryQueryDto } from './dto/library-query.dto';
import { MoveLibraryItemRequestDto } from './dto/move-library-item-request.dto';
import { UpdateLibraryItemRequestDto } from './dto/update-library-item-request.dto';
import { UpdateProgressRequestDto } from './dto/update-progress-request.dto';
import { LibraryService } from './library.service';

@ApiBearerAuth('bearer')
@ApiTags('Library')
@Controller('library')
@UseGuards(AccessTokenGuard)
export class LibraryController {
  public constructor(private readonly libraryService: LibraryService) {}

  @Post()
  @ApiOperation({ summary: 'Add a normalized book to the authenticated user library.' })
  @ApiCreatedResponse({ type: LibraryItemResponseDto })
  public addLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.addLibraryItem(userOwnerContext(user.id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a library item.' })
  @ApiNoContentResponse()
  public async deleteLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
  ): Promise<void> {
    await this.libraryService.deleteLibraryItem(userOwnerContext(user.id), libraryItemId);
  }

  @Get()
  @ApiOperation({ summary: 'List library items, optionally filtered by shelf.' })
  @ApiOkResponse({ type: LibraryItemResponseDto, isArray: true })
  public listLibraryItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryItemResponseDto[]> {
    return this.libraryService.listLibraryItems(userOwnerContext(user.id), query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a library item by id.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public getLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.getLibraryItem(userOwnerContext(user.id), libraryItemId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update rating and notes for a library item.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public updateLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: UpdateLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.updateLibraryItem(userOwnerContext(user.id), libraryItemId, dto);
  }

  @Patch(':id/shelf')
  @ApiOperation({ summary: 'Move a library item to another shelf.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public moveLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: MoveLibraryItemRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.moveLibraryItem(userOwnerContext(user.id), libraryItemId, dto);
  }

  @Post(':id/progress')
  @ApiOperation({ summary: 'Append a progress update and update completion state.' })
  @ApiOkResponse({ type: LibraryItemResponseDto })
  public updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) libraryItemId: string,
    @Body() dto: UpdateProgressRequestDto,
  ): Promise<LibraryItemResponseDto> {
    return this.libraryService.updateProgress(userOwnerContext(user.id), libraryItemId, dto);
  }
}
