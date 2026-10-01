import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BookPersistenceService } from '../books/book-persistence.service';
import type { BookSummaryDto } from '../books/dto/book-metadata-response.dto';
import { userOwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { LibraryService } from '../library/library.service';
import {
  AssociateBookshelfDetectionRequestDto,
  BookshelfBookLocationDto,
  BookshelfDetectionResponseDto,
  BookshelfPhotoDetailDto,
  BookshelfPhotoSummaryDto,
} from './dto/bookshelf-photo.dto';
import type { StoredBookshelfImage } from './bookshelf-image.service';

type DetectionManifest = {
  boundingBox: {
    height: number;
    rotationDegrees: number;
    width: number;
    x: number;
    y: number;
  };
  confidence: number;
  libraryItemId: null | string;
  observedAuthors: string[];
  observedIsbn10: null | string;
  observedIsbn13: null | string;
  observedPublisher: null | string;
  observedSpineText: string;
  observedTitle: null | string;
  position: number;
  selectedGoogleBooksVolumeId: null | string;
};

type PhotoRecord = Prisma.BookshelfPhotoGetPayload<{
  include: { detections: true };
}>;

/** Persists only explicitly saved photos and keeps every query scoped to one authenticated user. */
@Injectable()
export class BookshelfPhotoService {
  public constructor(
    private readonly bookPersistence: BookPersistenceService,
    private readonly imageLibrary: LibraryService,
    private readonly prisma: PrismaService,
  ) {}

  public async save(
    userId: string,
    image: StoredBookshelfImage,
    label: string | undefined,
    rawManifest: string,
  ): Promise<BookshelfPhotoDetailDto> {
    const manifest = parseManifest(rawManifest);
    const detections = await Promise.all(
      manifest.map((detection) => this.prepareDetection(userId, detection)),
    );
    const normalizedLabel =
      cleanLabel(label) ?? `Shelf photo ${new Date().toISOString().slice(0, 10)}`;

    const photo = await this.prisma.bookshelfPhoto.create({
      data: {
        detections: { create: detections },
        imageData: Uint8Array.from(image.buffer),
        imageHeight: image.height,
        imageMimeType: image.mimeType,
        imageWidth: image.width,
        label: normalizedLabel,
        thumbnailData: Uint8Array.from(image.thumbnail),
        thumbnailMimeType: image.thumbnailMimeType,
        userId,
      },
      include: { detections: { orderBy: { position: 'asc' } } },
    });

    return toPhotoDetail(photo);
  }

  public async list(userId: string): Promise<BookshelfPhotoSummaryDto[]> {
    const photos = await this.prisma.bookshelfPhoto.findMany({
      include: {
        detections: { select: { libraryItemId: true } },
      },
      orderBy: { createdAt: 'desc' },
      where: { userId },
    });

    return photos.map(toPhotoSummary);
  }

  public async get(userId: string, photoId: string): Promise<BookshelfPhotoDetailDto> {
    return toPhotoDetail(await this.getOwnedPhoto(userId, photoId));
  }

  public async locations(
    userId: string,
    libraryItemId: string,
  ): Promise<BookshelfBookLocationDto[]> {
    await this.imageLibrary.getLibraryItem(userOwnerContext(userId), libraryItemId);
    const detections = await this.prisma.bookshelfDetection.findMany({
      orderBy: [{ photo: { createdAt: 'desc' } }, { position: 'asc' }],
      select: {
        height: true,
        id: true,
        photo: {
          select: {
            createdAt: true,
            id: true,
            imageHeight: true,
            imageWidth: true,
            label: true,
          },
        },
        position: true,
        rotationDegrees: true,
        width: true,
        x: true,
        y: true,
      },
      where: { libraryItemId, photo: { userId } },
    });

    return detections.map((detection) => ({
      boundingBox: {
        height: detection.height,
        rotationDegrees: detection.rotationDegrees,
        width: detection.width,
        x: detection.x,
        y: detection.y,
      },
      detectionId: detection.id,
      imageHeight: detection.photo.imageHeight,
      imageWidth: detection.photo.imageWidth,
      photoCreatedAt: detection.photo.createdAt.toISOString(),
      photoId: detection.photo.id,
      photoLabel: detection.photo.label,
      position: detection.position,
    }));
  }

  public async image(
    userId: string,
    photoId: string,
    thumbnail: boolean,
  ): Promise<{ data: Buffer; mimeType: string }> {
    const photo = await this.prisma.bookshelfPhoto.findFirst({
      select: {
        imageData: true,
        imageMimeType: true,
        thumbnailData: true,
        thumbnailMimeType: true,
      },
      where: { id: photoId, userId },
    });

    if (!photo) {
      throw new NotFoundException('Bookshelf photo was not found.');
    }

    return thumbnail
      ? { data: Buffer.from(photo.thumbnailData), mimeType: photo.thumbnailMimeType }
      : { data: Buffer.from(photo.imageData), mimeType: photo.imageMimeType };
  }

  public async rename(
    userId: string,
    photoId: string,
    label: string,
  ): Promise<BookshelfPhotoDetailDto> {
    await this.ensureOwnedPhoto(userId, photoId);
    const normalizedLabel = cleanLabel(label);

    if (!normalizedLabel) {
      throw new BadRequestException('Bookshelf photo label is required.');
    }

    const photo = await this.prisma.bookshelfPhoto.update({
      data: { label: normalizedLabel },
      include: { detections: { orderBy: { position: 'asc' } } },
      where: { id: photoId },
    });
    return toPhotoDetail(photo);
  }

  public async delete(userId: string, photoId: string): Promise<void> {
    await this.ensureOwnedPhoto(userId, photoId);
    await this.prisma.bookshelfPhoto.delete({ where: { id: photoId } });
  }

  public async associate(
    userId: string,
    photoId: string,
    detectionId: string,
    request: AssociateBookshelfDetectionRequestDto,
  ): Promise<BookshelfDetectionResponseDto> {
    const detection = await this.prisma.bookshelfDetection.findFirst({
      where: { id: detectionId, photo: { id: photoId, userId } },
    });

    if (!detection) {
      throw new NotFoundException('Bookshelf detection was not found.');
    }

    const volumeId = cleanOptionalString(request.googleBooksVolumeId);
    const libraryItemId = cleanOptionalString(request.libraryItemId);
    const selectedBook = volumeId ? await this.resolveBookSummary(volumeId) : null;

    if (libraryItemId) {
      const item = await this.imageLibrary.getLibraryItem(userOwnerContext(userId), libraryItemId);

      if (!selectedBook || !summariesDescribeSameWork(selectedBook, item.book.summary)) {
        throw new BadRequestException(
          'The selected Google Books volume does not match the library item being associated.',
        );
      }
    }

    const updated = await this.prisma.bookshelfDetection.update({
      data: {
        libraryItemId,
        selectedBookSnapshot: selectedBook
          ? (selectedBook as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        selectedGoogleBooksVolumeId: volumeId,
      },
      where: { id: detection.id },
    });

    return toDetectionResponse(updated);
  }

  private async prepareDetection(userId: string, detection: DetectionManifest) {
    const selectedBook = detection.selectedGoogleBooksVolumeId
      ? await this.resolveBookSummary(detection.selectedGoogleBooksVolumeId)
      : null;

    if (detection.libraryItemId) {
      const item = await this.imageLibrary.getLibraryItem(
        userOwnerContext(userId),
        detection.libraryItemId,
      );

      if (!selectedBook || !summariesDescribeSameWork(selectedBook, item.book.summary)) {
        throw new BadRequestException(
          `Detection ${detection.position + 1} does not match its associated library item.`,
        );
      }
    }

    return {
      confidence: detection.confidence,
      height: detection.boundingBox.height,
      libraryItemId: detection.libraryItemId,
      observedAuthors: detection.observedAuthors,
      observedIsbn10: detection.observedIsbn10,
      observedIsbn13: detection.observedIsbn13,
      observedPublisher: detection.observedPublisher,
      observedSpineText: detection.observedSpineText,
      observedTitle: detection.observedTitle,
      position: detection.position,
      rotationDegrees: detection.boundingBox.rotationDegrees,
      selectedBookSnapshot: selectedBook
        ? (selectedBook as unknown as Prisma.InputJsonValue)
        : undefined,
      selectedGoogleBooksVolumeId: detection.selectedGoogleBooksVolumeId,
      width: detection.boundingBox.width,
      x: detection.boundingBox.x,
      y: detection.boundingBox.y,
    };
  }

  private async resolveBookSummary(volumeId: string): Promise<BookSummaryDto> {
    const book = await this.bookPersistence.getOrSyncGoogleVolume(volumeId);

    if (!book) {
      throw new BadRequestException('Selected Google Books volume was not found.');
    }

    const summary = this.bookPersistence.toBookMetadata(book).summary;

    if (!summary.isbn13 && !summary.isbn10) {
      throw new BadRequestException('Selected Google Books volume does not have a savable ISBN.');
    }

    return summary;
  }

  private async getOwnedPhoto(userId: string, photoId: string): Promise<PhotoRecord> {
    const photo = await this.prisma.bookshelfPhoto.findFirst({
      include: { detections: { orderBy: { position: 'asc' } } },
      where: { id: photoId, userId },
    });

    if (!photo) {
      throw new NotFoundException('Bookshelf photo was not found.');
    }

    return photo;
  }

  private async ensureOwnedPhoto(userId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.bookshelfPhoto.findFirst({
      select: { id: true },
      where: { id: photoId, userId },
    });

    if (!photo) {
      throw new NotFoundException('Bookshelf photo was not found.');
    }
  }
}

function parseManifest(value: string): DetectionManifest[] {
  if (value.length > 500_000) {
    throw new BadRequestException('Bookshelf detection manifest is too large.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadRequestException('Bookshelf detection manifest must be valid JSON.');
  }

  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed['detections']) ||
    parsed['detections'].length > 100
  ) {
    throw new BadRequestException('Bookshelf detection manifest is invalid.');
  }

  const detections = parsed['detections'].map(parseManifestDetection);
  const positions = new Set(detections.map((detection) => detection.position));

  if (positions.size !== detections.length) {
    throw new BadRequestException('Bookshelf detection positions must be unique.');
  }

  if (
    detections.some(
      (detection) =>
        detection.boundingBox.x + detection.boundingBox.width > 1000 ||
        detection.boundingBox.y + detection.boundingBox.height > 1000,
    )
  ) {
    throw new BadRequestException('Bookshelf detection coordinates must fit within the image.');
  }

  return detections.sort((left, right) => left.position - right.position);
}

function parseManifestDetection(value: unknown): DetectionManifest {
  if (!isRecord(value) || !isRecord(value['boundingBox'])) {
    throw new BadRequestException('Bookshelf detection manifest is invalid.');
  }

  const box = value['boundingBox'];
  return {
    boundingBox: {
      height: integerInRange(box['height'], 1, 1000),
      rotationDegrees: numberInRange(box['rotationDegrees'], -180, 180),
      width: integerInRange(box['width'], 1, 1000),
      x: integerInRange(box['x'], 0, 999),
      y: integerInRange(box['y'], 0, 999),
    },
    confidence: integerInRange(value['confidence'], 0, 100),
    libraryItemId: nullableString(value['libraryItemId'], 100),
    observedAuthors: stringArray(value['observedAuthors'], 8),
    observedIsbn10: nullableString(value['observedIsbn10'], 20),
    observedIsbn13: nullableString(value['observedIsbn13'], 20),
    observedPublisher: nullableString(value['observedPublisher'], 200),
    observedSpineText: requiredString(value['observedSpineText'], 500),
    observedTitle: nullableString(value['observedTitle'], 300),
    position: integerInRange(value['position'], 0, 999),
    selectedGoogleBooksVolumeId: nullableString(value['selectedGoogleBooksVolumeId'], 120),
  };
}

function toPhotoSummary(photo: {
  createdAt: Date;
  detections: Array<{ libraryItemId: null | string }>;
  id: string;
  imageHeight: number;
  imageWidth: number;
  kind: PhotoRecord['kind'];
  label: string;
  updatedAt: Date;
}): BookshelfPhotoSummaryDto {
  return {
    associatedDetectionCount: photo.detections.filter((item) => item.libraryItemId).length,
    createdAt: photo.createdAt.toISOString(),
    detectionCount: photo.detections.length,
    id: photo.id,
    imageHeight: photo.imageHeight,
    imageWidth: photo.imageWidth,
    kind: photo.kind,
    label: photo.label,
    updatedAt: photo.updatedAt.toISOString(),
  };
}

function toPhotoDetail(photo: PhotoRecord): BookshelfPhotoDetailDto {
  return {
    ...toPhotoSummary(photo),
    detections: photo.detections.map(toDetectionResponse),
  };
}

function toDetectionResponse(
  detection: PhotoRecord['detections'][number],
): BookshelfDetectionResponseDto {
  return {
    boundingBox: {
      height: detection.height,
      rotationDegrees: detection.rotationDegrees,
      width: detection.width,
      x: detection.x,
      y: detection.y,
    },
    confidence: detection.confidence,
    id: detection.id,
    libraryItemId: detection.libraryItemId,
    observedAuthors: detection.observedAuthors,
    observedIsbn10: detection.observedIsbn10,
    observedIsbn13: detection.observedIsbn13,
    observedPublisher: detection.observedPublisher,
    observedSpineText: detection.observedSpineText,
    observedTitle: detection.observedTitle,
    position: detection.position,
    selectedBook: isRecord(detection.selectedBookSnapshot)
      ? (detection.selectedBookSnapshot as unknown as BookSummaryDto)
      : null,
    selectedGoogleBooksVolumeId: detection.selectedGoogleBooksVolumeId,
  };
}

function summariesDescribeSameWork(left: BookSummaryDto, right: BookSummaryDto): boolean {
  if (
    (left.isbn13 && left.isbn13 === right.isbn13) ||
    (left.isbn10 && left.isbn10 === right.isbn10)
  ) {
    return true;
  }

  const titleScore = textSimilarity(left.title, right.title);
  const authorScore = Math.max(
    0,
    ...left.authors.flatMap((a) => right.authors.map((b) => textSimilarity(a, b))),
  );
  return titleScore >= 0.82 && (authorScore >= 0.45 || titleScore >= 0.94);
}

function textSimilarity(left: string, right: string): number {
  const leftSet = new Set(tokens(left));
  const rightSet = new Set(tokens(right));
  const union = new Set([...leftSet, ...rightSet]);
  return union.size === 0
    ? 0
    : [...leftSet].filter((token) => rightSet.has(token)).length / union.size;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function cleanLabel(value: string | undefined): null | string {
  return value?.trim().replace(/\s+/g, ' ').slice(0, 120) || null;
}

function cleanOptionalString(value: null | string | undefined): null | string {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function integerInRange(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new BadRequestException('Bookshelf detection manifest contains an invalid number.');
  }
  return value as number;
}

function numberInRange(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new BadRequestException('Bookshelf detection manifest contains an invalid number.');
  }
  return value;
}

function nullableString(value: unknown, maximumLength: number): null | string {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string' || value.length > maximumLength) {
    throw new BadRequestException('Bookshelf detection manifest contains invalid text.');
  }
  return value.trim() || null;
}

function requiredString(value: unknown, maximumLength: number): string {
  const result = nullableString(value, maximumLength);
  if (!result) {
    throw new BadRequestException('Bookshelf detection manifest is missing spine text.');
  }
  return result;
}

function stringArray(value: unknown, maximumItems: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new BadRequestException('Bookshelf detection manifest contains invalid authors.');
  }
  return value.map((item) => requiredString(item, 200));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
