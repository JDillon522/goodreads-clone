import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Provides the application-wide Prisma client configured with the PostgreSQL driver adapter.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Reads DATABASE_URL from validated configuration and constructs Prisma with the pg adapter.
   */
  public constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg(configService.getOrThrow<string>('DATABASE_URL')),
    });
  }
  /**
   * Opens the database connection when Nest initializes the module.
   */
  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  /**
   * Closes the database connection during Nest shutdown.
   */
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
