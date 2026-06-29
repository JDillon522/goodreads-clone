import { ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../src/database/prisma.service';
import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  const prismaService = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(prismaService);
  });

  it('returns service health metadata', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'bookshelf-backend',
      timestamp: expect.any(String),
      uptimeSeconds: expect.any(Number),
      version: expect.any(String),
    });
  });

  it('returns readiness when the database check succeeds', async () => {
    jest.spyOn(prismaService, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ready',
      service: 'bookshelf-backend',
      timestamp: expect.any(String),
      checks: {
        database: 'available',
      },
    });
  });

  it('throws a service unavailable exception when the database check fails', async () => {
    jest.spyOn(prismaService, '$queryRaw').mockRejectedValueOnce(new Error('database down'));

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
