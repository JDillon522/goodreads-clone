import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { DatabaseModule } from '../database/database.module';
import { ShelvesController } from './shelves.controller';
import { ShelvesService } from './shelves.service';

@Module({
  controllers: [ShelvesController],
  exports: [ShelvesService],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, ShelvesService],
})
export class ShelvesModule {}
