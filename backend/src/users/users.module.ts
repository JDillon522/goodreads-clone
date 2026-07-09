import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { UsersService } from './users.service';

/**
 * Provides user lookup and account creation helpers for auth and admin modules.
 */
@Module({
  exports: [UsersService],
  imports: [DatabaseModule],
  providers: [UsersService],
})
export class UsersModule {}
