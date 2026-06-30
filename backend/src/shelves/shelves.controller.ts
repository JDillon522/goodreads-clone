import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreateShelfRequestDto } from './dto/create-shelf-request.dto';
import { ShelfResponseDto } from './dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from './dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from './dto/update-shelf-request.dto';
import { ShelvesService } from './shelves.service';

@ApiBearerAuth('bearer')
@ApiTags('Shelves')
@Controller('shelves')
@UseGuards(AccessTokenGuard)
export class ShelvesController {
  public constructor(private readonly shelvesService: ShelvesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom shelf.' })
  @ApiCreatedResponse({ type: ShelfResponseDto })
  public createShelf(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.shelvesService.createShelf(userOwnerContext(user.id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an empty custom shelf.' })
  @ApiNoContentResponse()
  public async deleteShelf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<void> {
    await this.shelvesService.deleteShelf(userOwnerContext(user.id), shelfId);
  }

  @Get()
  @ApiOperation({ summary: 'List shelves for the authenticated user.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public listShelves(@CurrentUser() user: AuthenticatedUser): Promise<ShelfResponseDto[]> {
    return this.shelvesService.listShelves(userOwnerContext(user.id));
  }

  @Put('order')
  @ApiOperation({ summary: 'Replace shelf ordering.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public updateShelfOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateShelfOrderRequestDto,
  ): Promise<ShelfResponseDto[]> {
    return this.shelvesService.updateShelfOrder(userOwnerContext(user.id), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a shelf without changing its internal slug.' })
  @ApiOkResponse({ type: ShelfResponseDto })
  public updateShelf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Body() dto: UpdateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.shelvesService.updateShelf(userOwnerContext(user.id), shelfId, dto);
  }
}
