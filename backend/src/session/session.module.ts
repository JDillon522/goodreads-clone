import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { SessionController } from './session.controller';

/**
 * Wires the startup session-status endpoint with shared user/guest owner token validation.
 */
@Module({
  controllers: [SessionController],
  imports: [DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard],
})
export class SessionModule {}
