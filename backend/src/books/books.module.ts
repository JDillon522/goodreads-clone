import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { BookPersistenceService } from './book-persistence.service';
import { BookRelationsService } from './book-relations.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { GoogleBooksClientService } from './google-books/google-books-client.service';
import { OpenLibraryCacheService } from './open-library/open-library-cache.service';
import { OpenLibraryClientService } from './open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from './open-library/open-library-normalizer.service';

/**
 * Wires Google-first search/detail endpoints plus Open Library enrichment collaborators.
 */
@Module({
  controllers: [BooksController],
  exports: [BookPersistenceService],
  imports: [DatabaseModule],
  providers: [
    BookPersistenceService,
    BookRelationsService,
    BooksService,
    GoogleBooksClientService,
    OpenLibraryCacheService,
    OpenLibraryClientService,
    OpenLibraryNormalizerService,
  ],
})
export class BooksModule {}
