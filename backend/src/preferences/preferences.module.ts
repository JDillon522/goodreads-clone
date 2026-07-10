import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BooksModule } from '../books/books.module';
import { DatabaseModule } from '../database/database.module';
import { OwnerTokenGuard } from '../common/owner/owner-token.guard';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { ThemePaletteService } from './theme-palette.service';

/**
 * Wires owner-scoped preference endpoints and book-cover palette extraction.
 */
@Module({
  controllers: [PreferencesController],
  imports: [BooksModule, DatabaseModule, JwtModule.register({})],
  providers: [OwnerTokenGuard, PreferencesService, ThemePaletteService],
})
export class PreferencesModule {}
