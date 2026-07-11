import { ConfigService } from '@nestjs/config';

import { ActivityService } from '../src/activity/activity.service';
import { GuestService } from '../src/guest/guest.service';
import { PrismaService } from '../src/database/prisma.service';

type ShelfCreateArgs = {
  data: {
    slug: string;
  };
};

describe('GuestService', () => {
  const configService = {
    get: jest.fn().mockReturnValue(7),
  } as unknown as ConfigService;
  const emitWithExecutor = jest.fn().mockResolvedValue(undefined);
  const activityService = {
    emitWithExecutor,
  } as unknown as ActivityService;
  const guestSessionCreate = jest.fn((args: { data: { expiresAt: Date } }) =>
    Promise.resolve({
      expiresAt: args.data.expiresAt,
      id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    }),
  );
  const guestSessionDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
  const shelfCreate = jest.fn((args: ShelfCreateArgs) =>
    Promise.resolve({
      id: `shelf-${args.data.slug}`,
      slug: args.data.slug,
    }),
  );
  const userPreferenceCreate = jest.fn().mockResolvedValue({ id: 'preference-id' });
  const readingGoalCreate = jest.fn().mockResolvedValue({ id: 'goal-id' });
  const libraryItemCreate = jest.fn().mockResolvedValue({ id: 'library-item-id' });
  const readingProgressEntryCreate = jest.fn().mockResolvedValue({ id: 'progress-id' });
  const transaction = {
    guestSession: {
      create: guestSessionCreate,
    },
    libraryItem: {
      create: libraryItemCreate,
    },
    readingGoal: {
      create: readingGoalCreate,
    },
    readingProgressEntry: {
      create: readingProgressEntryCreate,
    },
    shelf: {
      create: shelfCreate,
    },
    userPreference: {
      create: userPreferenceCreate,
    },
  };
  const prismaService = {
    $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
    guestSession: {
      deleteMany: guestSessionDeleteMany,
    },
  } as unknown as PrismaService;

  let service: GuestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GuestService(activityService, configService, prismaService);
  });

  it('creates a guest session with default shelves and seeded library data', async () => {
    const response = await service.createSession();

    expect(response).toEqual({
      expiresAt: expect.any(String),
      guestToken: expect.any(String),
      sessionId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
      tokenType: 'Bearer',
    });
    expect(guestSessionCreate).toHaveBeenCalledWith({
      data: {
        expiresAt: expect.any(Date),
        label: 'Guest Demo',
        tokenHash: expect.any(String),
      },
    });
    expect(shelfCreate).toHaveBeenCalledTimes(4);
    expect(userPreferenceCreate).toHaveBeenCalledWith({
      data: {
        defaultShelfId: 'shelf-unshelved',
        displayMode: 'grid',
        guestSessionId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
        theme: 'SYSTEM',
      },
    });
    expect(readingGoalCreate).toHaveBeenCalledWith({
      data: {
        guestSessionId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
        targetBooks: 12,
        year: new Date().getUTCFullYear(),
      },
    });
    expect(libraryItemCreate).toHaveBeenCalledTimes(12);
    expect(transaction).not.toHaveProperty('book');
    expect(readingProgressEntryCreate).toHaveBeenCalled();
    expect(emitWithExecutor).toHaveBeenCalledWith(transaction, {
      metadata: {
        bookCount: 12,
        expiresAt: expect.any(String),
      },
      owner: {
        guestSessionId: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
        type: 'guest',
      },
      type: 'GUEST_SESSION_CREATED',
    });
  });

  it('deletes expired guest sessions through the cleanup method', async () => {
    const now = new Date('2026-06-30T12:00:00.000Z');

    await expect(service.cleanupExpiredSessions(now)).resolves.toEqual({ deletedSessions: 2 });
    expect(guestSessionDeleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
  });
});
