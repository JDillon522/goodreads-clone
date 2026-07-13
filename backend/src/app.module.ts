import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { BookshelvesModule } from './bookshelves/bookshelves.module';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { GoalsModule } from './goals/goals.module';
import { GuestModule } from './guest/guest.module';
import { HealthModule } from './health/health.module';
import { LibraryModule } from './library/library.module';
import { PreferencesModule } from './preferences/preferences.module';
import { ShelvesModule } from './shelves/shelves.module';
import { SessionModule } from './session/session.module';
import { StatsModule } from './stats/stats.module';

/**
 * Root Nest module that validates environment config and loads every Bookshelf feature module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: validateEnvironment,
    }),
    AdminModule,
    AuthModule,
    BooksModule,
    BookshelvesModule,
    DatabaseModule,
    GoalsModule,
    GuestModule,
    HealthModule,
    LibraryModule,
    PreferencesModule,
    ShelvesModule,
    SessionModule,
    StatsModule,
  ],
})
export class AppModule {}
