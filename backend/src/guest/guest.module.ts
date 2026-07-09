import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { DatabaseModule } from '../database/database.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

/**
 * Wires guest-session creation with database access and activity logging.
 */
@Module({
  controllers: [GuestController],
  exports: [GuestService],
  imports: [ActivityModule, DatabaseModule],
  providers: [GuestService],
})
export class GuestModule {}
