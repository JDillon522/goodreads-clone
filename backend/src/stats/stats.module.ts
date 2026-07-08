import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  exports: [StatsService],
  imports: [DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, StatsService],
})
export class StatsModule {}
