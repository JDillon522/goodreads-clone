import { PrismaService } from '../src/database/prisma.service';
import { UsersService } from '../src/users/users.service';

type ShelfCreateArgs = {
  data: {
    slug: string;
  };
};

describe('UsersService', () => {
  const user = {
    createdAt: new Date('2026-06-29T12:00:00.000Z'),
    displayName: 'Ada Reader',
    email: 'reader@example.com',
    id: '5e6121b5-bf5d-48cc-a0de-7b47fb04f7f5',
    passwordHash: 'hash',
    updatedAt: new Date('2026-06-29T12:00:00.000Z'),
  };
  const userCreate = jest.fn().mockResolvedValue(user);
  const shelfCreate = jest.fn((args: ShelfCreateArgs) =>
    Promise.resolve({
      id: `shelf-${args.data.slug}`,
      slug: args.data.slug,
    }),
  );
  const userPreferenceCreate = jest.fn().mockResolvedValue({ id: 'preference-id' });
  const transaction = {
    shelf: {
      create: shelfCreate,
    },
    user: {
      create: userCreate,
    },
    userPreference: {
      create: userPreferenceCreate,
    },
  };
  const prismaService = {
    $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as PrismaService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaService);
  });

  it('creates default shelves and preferences for a new user', async () => {
    await expect(
      service.createWithDefaults({
        displayName: 'Ada Reader',
        email: 'reader@example.com',
        passwordHash: 'hash',
      }),
    ).resolves.toEqual(user);

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        displayName: 'Ada Reader',
        email: 'reader@example.com',
        passwordHash: 'hash',
      },
    });
    expect(shelfCreate).toHaveBeenCalledTimes(3);
    expect(shelfCreate).toHaveBeenCalledWith({
      data: {
        isDefault: true,
        name: 'Want to Read',
        position: 0,
        slug: 'want-to-read',
        userId: user.id,
      },
    });
    expect(userPreferenceCreate).toHaveBeenCalledWith({
      data: {
        defaultShelfId: 'shelf-want-to-read',
        displayMode: 'grid',
        theme: 'SYSTEM',
        userId: user.id,
      },
    });
  });
});
