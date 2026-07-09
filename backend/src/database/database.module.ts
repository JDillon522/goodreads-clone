import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Provides PrismaService as a global database dependency for backend modules.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
