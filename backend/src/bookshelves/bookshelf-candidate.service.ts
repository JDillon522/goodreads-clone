import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { BooksService } from '../books/books.service';
import type { BookMetadataResponseDto } from '../books/dto/book-metadata-response.dto';
import { userOwnerContext } from '../common/owner/owner-context';
import type { LibraryItemResponseDto } from '../library/dto/library-item-response.dto';
import { LibraryService } from '../library/library.service';
import {
  BookshelfAnalysisResponseDto,
  BookshelfCandidateMatchRequestDto,
  BookshelfCandidateMatchResponseDto,
  BookshelfCandidateDto,
  BookshelfCandidateSearchResponseDto,
  BookshelfScanDetectionDto,
} from './dto/bookshelf-scan-response.dto';
import type { VisionBookshelfDetection } from './gemini-bookshelf-vision.service';

type CandidateObservation = Pick<
  VisionBookshelfDetection,
  'authors' | 'isbn10' | 'isbn13' | 'publisher' | 'spineText' | 'title'
>;

/** Resolves visual observations against Google Books and compares them with one user's library. */
@Injectable()
export class BookshelfCandidateService {
  public constructor(
    private readonly booksService: BooksService,
    private readonly libraryService: LibraryService,
  ) {}

  public buildAnalysis(
    model: string,
    observations: VisionBookshelfDetection[],
  ): BookshelfAnalysisResponseDto {
    const detections = observations.map((observation, position) =>
      scanDetection(observation, position, []),
    );
    return {
      count: detections.length,
      detections,
      model,
      providerIssues: [],
    };
  }

  public async match(
    userId: string,
    request: BookshelfCandidateMatchRequestDto,
  ): Promise<BookshelfCandidateMatchResponseDto> {
    const library = await this.libraryService.listLibraryItems(userOwnerContext(userId), {});
    const observation: CandidateObservation = {
      authors: request.observedAuthors,
      isbn10: request.observedIsbn10,
      isbn13: request.observedIsbn13,
      publisher: request.observedPublisher,
      spineText: request.observedSpineText,
      title: request.observedTitle,
    };

    return {
      candidates: await this.resolveCandidates(observation, library),
      detectionId: request.detectionId,
    };
  }

  public async search(userId: string, query: string): Promise<BookshelfCandidateSearchResponseDto> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const [results, library] = await Promise.all([
      this.searchGoogle(normalizedQuery, 10),
      this.libraryService.listLibraryItems(userOwnerContext(userId), {}),
    ]);

    return {
      items: results
        .filter(hasSavableIsbn)
        .map((book, index) => this.classifyCandidate(book, library, Math.max(50, 95 - index * 4))),
      query: normalizedQuery,
    };
  }

  private async resolveCandidates(
    observation: CandidateObservation,
    library: LibraryItemResponseDto[],
  ): Promise<BookshelfCandidateDto[]> {
    const query = observationQuery(observation);
    let results = query ? await this.searchGoogle(query, 12) : [];

    if (results.length === 0 && observation.title) {
      results = await this.searchGoogle(observation.title, 12);
    }

    return results
      .filter(hasSavableIsbn)
      .map((book) => ({ book, score: observationScore(observation, book) }))
      .filter(({ score }) => score >= 35)
      .sort((left, right) => right.score - left.score)
      .filter(uniqueBookIdentity())
      .slice(0, 3)
      .map(({ book, score }) => this.classifyCandidate(book, library, score));
  }

  private classifyCandidate(
    book: BookMetadataResponseDto,
    library: LibraryItemResponseDto[],
    matchScore: number,
  ): BookshelfCandidateDto {
    const exactMatches = library.filter((item) => isbnMatches(book, item));

    if (exactMatches.length > 0) {
      return {
        book,
        classification: 'EXACT_EDITION',
        libraryMatches: exactMatches,
        matchScore: Math.round(matchScore),
      };
    }

    const workMatches = library.filter((item) => sameWork(book, item));

    return {
      book,
      classification:
        workMatches.length === 0
          ? 'NEW'
          : workMatches.length === 1
            ? 'DIFFERENT_EDITION'
            : 'NEEDS_REVIEW',
      libraryMatches: workMatches,
      matchScore: Math.round(matchScore),
    };
  }

  private async searchGoogle(query: string, limit: number): Promise<BookMetadataResponseDto[]> {
    const response = await this.booksService.searchBooks({
      limit,
      orderBy: 'relevance',
      page: 1,
      printType: 'books',
      query,
    });
    return response.items;
  }
}

function scanDetection(
  observation: VisionBookshelfDetection,
  position: number,
  candidates: BookshelfCandidateDto[],
): BookshelfScanDetectionDto {
  return {
    boundingBox: {
      height: observation.height,
      rotationDegrees: observation.rotationDegrees,
      width: observation.width,
      x: observation.x,
      y: observation.y,
    },
    candidates,
    confidence: observation.confidence,
    id: randomUUID(),
    observedAuthors: observation.authors,
    observedIsbn10: observation.isbn10,
    observedIsbn13: observation.isbn13,
    observedPublisher: observation.publisher,
    observedSpineText: observation.spineText,
    observedTitle: observation.title,
    position,
  };
}

function observationQuery(observation: CandidateObservation): string {
  if (observation.isbn13 || observation.isbn10) {
    return `isbn:${observation.isbn13 ?? observation.isbn10}`;
  }

  const title = observation.title ?? observation.spineText;
  const author = observation.authors[0];
  return [
    title ? `intitle:${quotePhrase(title)}` : '',
    author ? `inauthor:${quotePhrase(author)}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function observationScore(
  observation: CandidateObservation,
  book: BookMetadataResponseDto,
): number {
  const summary = book.summary;

  if (
    (observation.isbn13 && observation.isbn13 === summary.isbn13) ||
    (observation.isbn10 && observation.isbn10 === summary.isbn10)
  ) {
    return 100;
  }

  const title = observation.title ?? observation.spineText;
  const titleScore = textSimilarity(title, summary.title);
  const authorScore = arraySimilarity(observation.authors, summary.authors);
  const publisherScore = textSimilarity(observation.publisher ?? '', summary.publisher ?? '');
  return Math.min(99, Math.round(titleScore * 72 + authorScore * 20 + publisherScore * 8));
}

function isbnMatches(book: BookMetadataResponseDto, item: LibraryItemResponseDto): boolean {
  return Boolean(
    (book.summary.isbn13 && book.summary.isbn13 === item.book.summary.isbn13) ||
    (book.summary.isbn10 && book.summary.isbn10 === item.book.summary.isbn10),
  );
}

function sameWork(book: BookMetadataResponseDto, item: LibraryItemResponseDto): boolean {
  const titleScore = textSimilarity(book.summary.title, item.book.summary.title);
  const authorScore = arraySimilarity(book.summary.authors, item.book.summary.authors);
  return titleScore >= 0.82 && (authorScore >= 0.45 || titleScore >= 0.94);
}

function hasSavableIsbn(book: BookMetadataResponseDto): boolean {
  return Boolean(book.summary.isbn13 || book.summary.isbn10);
}

function uniqueBookIdentity(): (value: {
  book: BookMetadataResponseDto;
  score: number;
}) => boolean {
  const seen = new Set<string>();
  return ({ book }) => {
    const identity = book.summary.isbn13 ?? book.summary.isbn10 ?? book.id;
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  };
}

function arraySimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  return Math.max(...left.flatMap((a) => right.map((b) => textSimilarity(a, b))));
}

function textSimilarity(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  if (leftTokens.join(' ') === rightTokens.join(' ')) {
    return 1;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length > 1);
}

function quotePhrase(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
