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

import { CurrentOwner } from '../common/owner/current-owner.decorator';
import type { OwnerContext } from '../common/owner/owner-context';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { CreateShelfRequestDto } from './dto/create-shelf-request.dto';
import { ShelfResponseDto } from './dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from './dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from './dto/update-shelf-request.dto';
import { ShelvesService } from './shelves.service';

@ApiBearerAuth('bearer')
@ApiTags('Shelves')
@Controller('shelves')
@UseGuards(OwnerTokenGuard)
export class ShelvesController {
  public constructor(private readonly shelvesService: ShelvesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a custom shelf for the current library owner.' })
  @ApiCreatedResponse({ type: ShelfResponseDto })
  public createShelf(
    @CurrentOwner() owner: OwnerContext,
    @Body() dto: CreateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.shelvesService.createShelf(owner, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an empty custom shelf.' })
  @ApiNoContentResponse()
  public async deleteShelf(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<void> {
    await this.shelvesService.deleteShelf(owner, shelfId);
  }

  @Get()
  @ApiOperation({ summary: 'List shelves for the current library owner.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public listShelves(@CurrentOwner() owner: OwnerContext): Promise<ShelfResponseDto[]> {
    return this.shelvesService.listShelves(owner);
  }

  @Put('order')
  @ApiOperation({ summary: 'Replace shelf ordering.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public updateShelfOrder(
    @CurrentOwner() owner: OwnerContext,
    @Body() dto: UpdateShelfOrderRequestDto,
  ): Promise<ShelfResponseDto[]> {
    return this.shelvesService.updateShelfOrder(owner, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a shelf without changing its internal slug.' })
  @ApiOkResponse({ type: ShelfResponseDto })
  public updateShelf(
    @CurrentOwner() owner: OwnerContext,
    @Param('id', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Body() dto: UpdateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.shelvesService.updateShelf(owner, shelfId, dto);
  }
}
