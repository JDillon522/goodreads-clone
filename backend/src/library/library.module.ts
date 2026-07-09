import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

/**
 * Wires owner-scoped library item endpoints with activity logging and token ownership guards.
 */
@Module({
  controllers: [LibraryController],
  exports: [LibraryService],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, LibraryService],
})
export class LibraryModule {}
