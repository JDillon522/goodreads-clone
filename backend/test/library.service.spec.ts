import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookProvider, GoogleBooksSyncStatus, LibraryItemStatus } from '@prisma/client';

import { ActivityService } from '../src/activity/activity.service';
import { BookPersistenceService } from '../src/books/book-persistence.service';
import { userOwnerContext } from '../src/common/owner/owner-context';
import { PrismaService } from '../src/database/prisma.service';
import { LibraryService } from '../src/library/library.service';

describe('LibraryService edition replacement', () => {
  const timestamp = new Date('2026-07-11T12:00:00.000Z');
  const owner = userOwnerContext('11111111-1111-4111-8111-111111111111');
  const shelf = {
    createdAt: timestamp,
    deactivatedAt: null,
    guestSessionId: null,
    id: '22222222-2222-4222-8222-222222222222',
    isDefault: true,
    name: 'Currently reading',
    position: 1,
    slug: 'currently-reading',
    updatedAt: timestamp,
    userId: owner.userId,
  };
  const item = {
    createdAt: timestamp,
    currentPage: 123,
    currentPercent: { toNumber: () => 41 },
    dateAdded: timestamp,
    dateFinished: null,
    dedupeKey: 'isbn13:9780000000001',
    guestSessionId: null,
    id: '33333333-3333-4333-8333-333333333333',
    isbn10: null,
    isbn13: '9780000000001',
    notes: 'Keep this note.',
    progressUpdatedAt: timestamp,
    rating: 5,
    shelves: [
      {
        createdAt: timestamp,
        id: '44444444-4444-4444-8444-444444444444',
        libraryItemId: '33333333-3333-4333-8333-333333333333',
        shelf,
        shelfId: shelf.id,
      },
    ],
    status: LibraryItemStatus.READING,
    updatedAt: timestamp,
    userId: owner.userId,
  };
  const replacementBook = {
    createdAt: timestamp,
    googleBooksError: null,
    googleBooksRawPayload: {},
    googleBooksSyncedAt: timestamp,
    googleBooksSyncStatus: GoogleBooksSyncStatus.SYNCED,
    googleBooksVolumeId: 'replacement-volume',
    id: '55555555-5555-4555-8555-555555555555',
    isbn10: '0000000022',
    isbn13: '9780000000002',
    normalizedPrimaryAuthor: 'ada author',
    normalizedTitle: 'the test book',
    rawProviderPayload: null,
    sourceId: 'isbn13:9780000000002',
    sourceProvider: BookProvider.GOOGLE_BOOKS,
    sourceUrl: null,
    updatedAt: timestamp,
  };
  const replacementMetadata = {
    google: {},
    id: replacementBook.id,
    summary: {
      isbn10: replacementBook.isbn10,
      isbn13: replacementBook.isbn13,
    },
    sync: {},
  };
  const findFirst = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    $transaction: transaction,
    libraryItem: { findFirst, update },
    readingProgressEntry: { deleteMany },
  };
  const getOrSyncGoogleVolume = jest.fn();
  const ensureBookForIdentity = jest.fn();
  const toBookMetadata = jest.fn();
  const bookPersistence = {
    ensureBookForIdentity,
    getOrSyncGoogleVolume,
    toBookMetadata,
  } as unknown as BookPersistenceService;
  const service = new LibraryService(
    {} as ActivityService,
    bookPersistence,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation((operation: (executor: unknown) => unknown) =>
      operation(prisma),
    );
    findFirst.mockResolvedValueOnce(item).mockResolvedValueOnce(null);
    getOrSyncGoogleVolume.mockResolvedValue(replacementBook);
    ensureBookForIdentity.mockResolvedValue(replacementBook);
    toBookMetadata.mockReturnValue(replacementMetadata);
    update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...item,
      ...data,
      updatedAt: timestamp,
    }));
  });

  it('replaces ISBN identity and clears edition-specific progress while preserving personal state', async () => {
    const result = await service.replaceLibraryItemEdition(owner, item.id, {
      googleBooksVolumeId: ' replacement-volume ',
    });

    expect(getOrSyncGoogleVolume).toHaveBeenCalledWith('replacement-volume');
    expect(findFirst).toHaveBeenLastCalledWith({
      select: { id: true },
      where: {
        dedupeKey: 'isbn13:9780000000002',
        id: { not: item.id },
        userId: owner.userId,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { libraryItemId: item.id } });
    expect(update).toHaveBeenCalledWith({
      data: {
        currentPage: null,
        currentPercent: null,
        dedupeKey: 'isbn13:9780000000002',
        isbn10: '0000000022',
        isbn13: '9780000000002',
        progressUpdatedAt: null,
      },
      include: expect.any(Object),
      where: { id: item.id },
    });
    expect(result).toEqual(
      expect.objectContaining({
        currentPage: null,
        currentPercent: null,
        notes: item.notes,
        rating: item.rating,
        status: item.status,
      }),
    );
  });

  it('rejects replacing with an edition already owned by the same user', async () => {
    findFirst.mockReset();
    findFirst.mockResolvedValueOnce(item).mockResolvedValueOnce({ id: 'duplicate-item-id' });

    await expect(
      service.replaceLibraryItemEdition(owner, item.id, {
        googleBooksVolumeId: 'replacement-volume',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a Google volume id that does not resolve to that exact edition', async () => {
    getOrSyncGoogleVolume.mockResolvedValueOnce({
      ...replacementBook,
      googleBooksVolumeId: 'different-volume',
    });

    await expect(
      service.replaceLibraryItemEdition(owner, item.id, {
        googleBooksVolumeId: 'replacement-volume',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
