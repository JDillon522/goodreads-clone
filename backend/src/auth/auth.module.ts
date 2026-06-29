import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';

@Module({
  controllers: [AuthController],
  imports: [DatabaseModule, JwtModule.register({}), UsersModule],
  providers: [AccessTokenGuard, AuthService],
})
export class AuthModule {}
