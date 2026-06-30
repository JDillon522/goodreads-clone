import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { OpenLibraryCacheService } from './open-library/open-library-cache.service';
import { OpenLibraryClientService } from './open-library/open-library-client.service';
import { OpenLibraryNormalizerService } from './open-library/open-library-normalizer.service';

@Module({
  controllers: [BooksController],
  imports: [DatabaseModule],
  providers: [
    BooksService,
    OpenLibraryCacheService,
    OpenLibraryClientService,
    OpenLibraryNormalizerService,
  ],
})
export class BooksModule {}
