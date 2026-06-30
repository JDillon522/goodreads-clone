import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DatabaseModule } from '../database/database.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  controllers: [LibraryController],
  exports: [LibraryService],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [AccessTokenGuard, LibraryService],
})
export class LibraryModule {}
