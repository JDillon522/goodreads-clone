import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BookPersistenceService } from '../src/books/book-persistence.service';
import { BookshelfPhotoService } from '../src/bookshelves/bookshelf-photo.service';
import { PrismaService } from '../src/database/prisma.service';
import { LibraryService } from '../src/library/library.service';

const now = new Date('2026-07-12T12:00:00.000Z');
const selectedSummary = {
  authors: ['Octavia E. Butler'],
  averageRating: null,
  categories: ['Fiction'],
  coverImages: { card: null, detail: null, theme: null, thumbnail: null },
  coverUrl: null,
  dedupeKey: 'isbn13:9780807083697',
  description: null,
  ebookAccess: null,
  externalLinks: { buy: null, canonical: null, info: null, preview: null, webReader: null },
  genres: ['Fiction'],
  googleBooksVolumeId: 'kindred-volume',
  isbn10: '0807083690',
  isbn13: '9780807083697',
  isReadableOnline: false,
  language: 'en',
  pageCount: 288,
  primaryAuthor: 'Octavia E. Butler',
  printType: 'BOOK',
  providerKey: 'google:kindred-volume',
  publishedDate: '1979',
  publisher: 'Beacon Press',
  ratingsCount: null,
  subtitle: null,
  title: 'Kindred',
};

describe('BookshelfPhotoService', () => {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const deletePhoto = jest.fn();
  const updateDetection = jest.fn();
  const findDetectionMany = jest.fn();
  const getOrSyncGoogleVolume = jest.fn();
  const toBookMetadata = jest.fn();
  const getLibraryItem = jest.fn();
  const prisma = {
    bookshelfDetection: { findFirst, findMany: findDetectionMany, update: updateDetection },
    bookshelfPhoto: { create, delete: deletePhoto, findFirst, findMany, update },
  } as unknown as PrismaService;
  const service = new BookshelfPhotoService(
    { getOrSyncGoogleVolume, toBookMetadata } as unknown as BookPersistenceService,
    { getLibraryItem } as unknown as LibraryService,
    prisma,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getOrSyncGoogleVolume.mockResolvedValue({ id: 'book-cache-id' });
    toBookMetadata.mockReturnValue({ summary: selectedSummary });
    getLibraryItem.mockResolvedValue({ book: { summary: selectedSummary }, id: 'item-1' });
  });

  it('stores bytes only when save is explicitly invoked and preserves reviewed coordinates', async () => {
    create.mockResolvedValue({
      createdAt: now,
      detections: [
        {
          confidence: 92,
          createdAt: now,
          height: 760,
          id: 'detection-0',
          libraryItemId: 'item-1',
          observedAuthors: ['Octavia E. Butler'],
          observedIsbn10: null,
          observedIsbn13: null,
          observedPublisher: null,
          observedSpineText: 'KINDRED',
          observedTitle: 'Kindred',
          photoId: 'photo-1',
          position: 0,
          rotationDegrees: 0,
          selectedBookSnapshot: selectedSummary,
          selectedGoogleBooksVolumeId: 'kindred-volume',
          updatedAt: now,
          width: 90,
          x: 100,
          y: 80,
        },
      ],
      gridColumnLabel: null,
      gridRowLabel: null,
      id: 'photo-1',
      imageData: Uint8Array.from(Buffer.from('original')),
      imageHeight: 800,
      imageMimeType: 'image/jpeg',
      imageWidth: 1200,
      kind: 'SHELF',
      label: 'Office shelf',
      parentPhotoId: null,
      parentRegion: null,
      thumbnailData: Uint8Array.from(Buffer.from('thumb')),
      thumbnailMimeType: 'image/webp',
      updatedAt: now,
      userId: 'user-1',
    });
    const manifest = JSON.stringify({
      detections: [
        {
          boundingBox: { height: 760, rotationDegrees: 0, width: 90, x: 100, y: 80 },
          confidence: 92,
          libraryItemId: 'item-1',
          observedAuthors: ['Octavia E. Butler'],
          observedIsbn10: null,
          observedIsbn13: null,
          observedPublisher: null,
          observedSpineText: 'KINDRED',
          observedTitle: 'Kindred',
          position: 0,
          selectedGoogleBooksVolumeId: 'kindred-volume',
        },
      ],
    });

    await expect(
      service.save(
        'user-1',
        {
          buffer: Buffer.from('original'),
          height: 800,
          mimeType: 'image/jpeg',
          thumbnail: Buffer.from('thumb'),
          thumbnailMimeType: 'image/webp',
          width: 1200,
        },
        'Office shelf',
        manifest,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        associatedDetectionCount: 1,
        detectionCount: 1,
        id: 'photo-1',
        label: 'Office shelf',
      }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageData: expect.any(Uint8Array),
          thumbnailData: expect.any(Uint8Array),
          userId: 'user-1',
        }),
      }),
    );
  });

  it('rejects out-of-bounds manifests before any database write', async () => {
    const manifest = JSON.stringify({
      detections: [
        {
          boundingBox: { height: 100, rotationDegrees: 0, width: 200, x: 900, y: 0 },
          confidence: 50,
          libraryItemId: null,
          observedAuthors: [],
          observedSpineText: 'UNKNOWN',
          position: 0,
          selectedGoogleBooksVolumeId: null,
        },
      ],
    });
    await expect(
      service.save(
        'user-1',
        {
          buffer: Buffer.from('original'),
          height: 800,
          mimeType: 'image/jpeg',
          thumbnail: Buffer.from('thumb'),
          thumbnailMimeType: 'image/webp',
          width: 1200,
        },
        undefined,
        manifest,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns not found instead of exposing another user’s photo bytes', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.image('user-1', 'other-photo', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-photo', userId: 'user-1' } }),
    );
  });

  it('returns owner-scoped physical locations for a library item', async () => {
    findDetectionMany.mockResolvedValue([
      {
        height: 760,
        id: 'detection-1',
        photo: {
          createdAt: now,
          id: 'photo-1',
          imageHeight: 800,
          imageWidth: 1200,
          label: 'Office shelf',
        },
        position: 2,
        rotationDegrees: 0,
        width: 90,
        x: 100,
        y: 80,
      },
    ]);

    await expect(service.locations('user-1', 'item-1')).resolves.toEqual([
      expect.objectContaining({
        boundingBox: { height: 760, rotationDegrees: 0, width: 90, x: 100, y: 80 },
        detectionId: 'detection-1',
        photoId: 'photo-1',
        photoLabel: 'Office shelf',
      }),
    ]);
    expect(getLibraryItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user', userId: 'user-1' }),
      'item-1',
    );
    expect(findDetectionMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { libraryItemId: 'item-1', photo: { userId: 'user-1' } } }),
    );
  });
});
