import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BooksModule } from '../books/books.module';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/**
 * Wires owner-scoped stats and year-in-review endpoints.
 */
@Module({
  controllers: [StatsController],
  exports: [StatsService],
  imports: [BooksModule, DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, StatsService],
})
export class StatsModule {}
