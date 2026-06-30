import { Injectable } from '@nestjs/common';
import { ActivityEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import type { OwnerContext } from '../common/owner/owner-context';

type ActivityInput = {
  libraryItemId?: string;
  metadata?: Prisma.InputJsonValue;
  owner: OwnerContext;
  type: ActivityEventType;
};

type ActivityExecutor = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ActivityService {
  public constructor(private readonly prisma: PrismaService) {}

  public async emit(input: ActivityInput): Promise<void> {
    await this.emitWithExecutor(this.prisma, input);
  }

  public async emitWithExecutor(executor: ActivityExecutor, input: ActivityInput): Promise<void> {
    await executor.activityEvent.create({
      data: {
        libraryItemId: input.libraryItemId,
        metadata: input.metadata,
        type: input.type,
        userId: input.owner.userId,
      },
    });
  }
}
