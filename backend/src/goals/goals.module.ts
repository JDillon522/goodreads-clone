import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DatabaseModule } from '../database/database.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  controllers: [GoalsController],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [AccessTokenGuard, GoalsService],
})
export class GoalsModule {}
