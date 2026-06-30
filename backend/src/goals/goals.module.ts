import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  controllers: [GoalsController],
  exports: [GoalsService],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, GoalsService],
})
export class GoalsModule {}
