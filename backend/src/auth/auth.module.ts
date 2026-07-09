import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard } from './guards/admin.guard';
import { AccessTokenGuard } from './guards/access-token.guard';

/**
 * Wires account-auth endpoints, token guards, JWT support, and user lookup dependencies.
 */
@Module({
  controllers: [AuthController],
  exports: [AccessTokenGuard, AdminGuard],
  imports: [DatabaseModule, JwtModule.register({}), UsersModule],
  providers: [AccessTokenGuard, AdminGuard, AuthService],
})
export class AuthModule {}
