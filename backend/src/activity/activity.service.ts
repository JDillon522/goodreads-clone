import { Injectable } from '@nestjs/common';
import { ActivityEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';

/**
 * Writes owner-scoped activity events used by dashboards, stats, and audit-style history. Services
 * can emit inside their existing transactions to keep activity aligned with the data change.
 */
type ActivityInput = {
  libraryItemId?: string;
  metadata?: Prisma.InputJsonValue;
  owner: OwnerContext;
  type: ActivityEventType;
};

type ActivityExecutor = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ActivityService {
  /**
   * Receives Prisma from Nest.
   */
  public constructor(private readonly prisma: PrismaService) {}
  /**
   * Emits an activity event outside an existing transaction.
   */
  public async emit(input: ActivityInput): Promise<void> {
    await this.emitWithExecutor(this.prisma, input);
  }
  /**
   * Emits an activity event using the provided Prisma client or transaction executor.
   */
  public async emitWithExecutor(executor: ActivityExecutor, input: ActivityInput): Promise<void> {
    await executor.activityEvent.create({
      data: {
        libraryItemId: input.libraryItemId,
        metadata: input.metadata,
        type: input.type,
        ...ownerRecord(input.owner),
      },
    });
  }
}
