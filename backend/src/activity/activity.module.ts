import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ActivityService } from './activity.service';

@Module({
  exports: [ActivityService],
  imports: [DatabaseModule],
  providers: [ActivityService],
})
export class ActivityModule {}
