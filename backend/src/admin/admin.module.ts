import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ShelvesModule } from '../shelves/shelves.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  imports: [AuthModule, DatabaseModule, JwtModule.register({}), ShelvesModule, UsersModule],
  providers: [AdminService],
})
export class AdminModule {}
