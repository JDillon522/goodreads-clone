import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AuthModule,
    BooksModule,
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
