import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ActivityModule } from '../activity/activity.module';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DatabaseModule } from '../database/database.module';
import { ShelvesController } from './shelves.controller';
import { ShelvesService } from './shelves.service';

@Module({
  controllers: [ShelvesController],
  exports: [ShelvesService],
  imports: [ActivityModule, DatabaseModule, JwtModule.register({})],
  providers: [AccessTokenGuard, ShelvesService],
})
export class ShelvesModule {}
