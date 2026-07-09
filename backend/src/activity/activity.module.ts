import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ActivityService } from './activity.service';

/**
 * Provides ActivityService for feature modules that write owner-scoped activity events.
 */
@Module({
  exports: [ActivityService],
  imports: [DatabaseModule],
  providers: [ActivityService],
})
export class ActivityModule {}
