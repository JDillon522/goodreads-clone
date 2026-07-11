import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { BookPersistenceService } from './book-persistence.service';
import { BookRelationsService } from './book-relations.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { GoogleBooksClientService } from './google-books/google-books-client.service';

/**
 * Wires the Google Books search/detail, cache, and related-book collaborators.
 */
@Module({
  controllers: [BooksController],
  exports: [BookPersistenceService],
  imports: [DatabaseModule],
  providers: [BookPersistenceService, BookRelationsService, BooksService, GoogleBooksClientService],
})
export class BooksModule {}
