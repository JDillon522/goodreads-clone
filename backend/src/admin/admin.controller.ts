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

import { AdminGuard } from '../auth/guards/admin.guard';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CreateShelfRequestDto } from '../shelves/dto/create-shelf-request.dto';
import { DeleteShelfResponseDto } from '../shelves/dto/delete-shelf-response.dto';
import { ShelfResponseDto } from '../shelves/dto/shelf-response.dto';
import { UpdateShelfOrderRequestDto } from '../shelves/dto/update-shelf-order-request.dto';
import { UpdateShelfRequestDto } from '../shelves/dto/update-shelf-request.dto';
import { AdminService } from './admin.service';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { CreateAdminUserRequestDto } from './dto/create-admin-user-request.dto';
import { UpdateAdminUserRequestDto } from './dto/update-admin-user-request.dto';

@ApiBearerAuth('bearer')
@ApiTags('Admin')
@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  public constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users for admin management.' })
  @ApiOkResponse({ type: AdminUserResponseDto, isArray: true })
  public listUsers(): Promise<AdminUserResponseDto[]> {
    return this.adminService.listUsers();
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a user with standard shelves.' })
  @ApiCreatedResponse({ type: AdminUserResponseDto })
  public createUser(@Body() dto: CreateAdminUserRequestDto): Promise<AdminUserResponseDto> {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Update user identity, password, or role.' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  public updateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateAdminUserRequestDto,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.updateUser(userId, dto);
  }

  @Delete('users/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hard-delete a user and owned records.' })
  @ApiNoContentResponse()
  public deleteUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.adminService.deleteUser(userId);
  }

  @Post('users/:userId/deactivate')
  @ApiOperation({ summary: 'Deactivate a user account.' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  public deactivateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.deactivateUser(userId);
  }

  @Post('users/:userId/reactivate')
  @ApiOperation({ summary: 'Reactivate a user account.' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  public reactivateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<AdminUserResponseDto> {
    return this.adminService.reactivateUser(userId);
  }

  @Get('users/:userId/shelves')
  @ApiOperation({ summary: 'List active and deactivated shelves for a user.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public listUserShelves(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<ShelfResponseDto[]> {
    return this.adminService.listUserShelves(userId);
  }

  @Post('users/:userId/shelves')
  @ApiOperation({ summary: 'Create a shelf for a user.' })
  @ApiCreatedResponse({ type: ShelfResponseDto })
  public createUserShelf(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: CreateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.adminService.createUserShelf(userId, dto);
  }

  @Put('users/:userId/shelves/order')
  @ApiOperation({ summary: 'Replace shelf ordering for a user.' })
  @ApiOkResponse({ type: ShelfResponseDto, isArray: true })
  public updateUserShelfOrder(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() dto: UpdateShelfOrderRequestDto,
  ): Promise<ShelfResponseDto[]> {
    return this.adminService.updateUserShelfOrder(userId, dto);
  }

  @Patch('users/:userId/shelves/:shelfId')
  @ApiOperation({ summary: 'Update a user shelf.' })
  @ApiOkResponse({ type: ShelfResponseDto })
  public updateUserShelf(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
    @Body() dto: UpdateShelfRequestDto,
  ): Promise<ShelfResponseDto> {
    return this.adminService.updateUserShelf(userId, shelfId, dto);
  }

  @Delete('users/:userId/shelves/:shelfId')
  @ApiOperation({ summary: 'Delete a user shelf with Unshelved fallback handling.' })
  @ApiOkResponse({ type: DeleteShelfResponseDto })
  public deleteUserShelf(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<DeleteShelfResponseDto> {
    return this.adminService.deleteUserShelf(userId, shelfId);
  }

  @Post('users/:userId/shelves/:shelfId/deactivate')
  @ApiOperation({ summary: 'Deactivate a user shelf.' })
  @ApiOkResponse({ type: ShelfResponseDto })
  public deactivateUserShelf(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<ShelfResponseDto> {
    return this.adminService.deactivateUserShelf(userId, shelfId);
  }

  @Post('users/:userId/shelves/:shelfId/reactivate')
  @ApiOperation({ summary: 'Reactivate a user shelf.' })
  @ApiOkResponse({ type: ShelfResponseDto })
  public reactivateUserShelf(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('shelfId', new ParseUUIDPipe({ version: '4' })) shelfId: string,
  ): Promise<ShelfResponseDto> {
    return this.adminService.reactivateUserShelf(userId, shelfId);
  }
}
