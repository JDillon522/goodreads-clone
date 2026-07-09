import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

/**
 * Wires system health and readiness endpoints.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
