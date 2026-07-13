import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { DatabaseModule } from '../database/database.module';
import { LibraryModule } from '../library/library.module';
import { BookshelfCandidateService } from './bookshelf-candidate.service';
import { BookshelfImageService } from './bookshelf-image.service';
import { BookshelfPhotoService } from './bookshelf-photo.service';
import { BookshelfPhotosController } from './bookshelf-photos.controller';
import { BookshelfScansController } from './bookshelf-scans.controller';
import { GeminiBookshelfVisionService } from './gemini-bookshelf-vision.service';

/** Wires signed-in shelf-photo analysis, reconciliation, and explicitly retained media. */
@Module({
  controllers: [BookshelfScansController, BookshelfPhotosController],
  imports: [AuthModule, BooksModule, DatabaseModule, JwtModule.register({}), LibraryModule],
  providers: [
    BookshelfCandidateService,
    BookshelfImageService,
    BookshelfPhotoService,
    GeminiBookshelfVisionService,
  ],
})
export class BookshelvesModule {}
