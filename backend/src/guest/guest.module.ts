import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { DatabaseModule } from '../database/database.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  controllers: [GuestController],
  exports: [GuestService],
  imports: [ActivityModule, DatabaseModule],
  providers: [GuestService],
})
export class GuestModule {}
