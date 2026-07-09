import { Injectable } from '@nestjs/common';
import { ActivityEventType, Prisma } from '@prisma/client';

import { ActivityService } from '../activity/activity.service';
import { ownerRecord, type OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { ReadingGoalResponseDto } from './dto/reading-goal-response.dto';
import { UpdateReadingGoalRequestDto } from './dto/update-reading-goal-request.dto';
import { calculateGoalStats } from './goal-rules';

/**
 * Owns yearly reading goals for user and guest owners, including progress stats and activity events
 * when goals are set or completed.
 */
type ReadingGoalRecord = {
  completedAt: Date | null;
  id: string | null;
  targetBooks: number;
  year: number;
};

@Injectable()
export class GoalsService {
  /**
   * Receives persistence and activity dependencies from Nest.
   */
  public constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Returns the goal for the current calendar year.
   */
  public async getCurrentGoal(owner: OwnerContext): Promise<ReadingGoalResponseDto> {
    return this.getGoalForYear(owner, new Date().getFullYear());
  }
  /**
   * Returns a persisted yearly goal or the default goal shape when none has been saved yet.
   */
  public async getGoalForYear(owner: OwnerContext, year: number): Promise<ReadingGoalResponseDto> {
    const goal = await this.prisma.readingGoal.findFirst({
      where: {
        ...this.ownerWhere(owner),
        year,
      },
    });

    return this.toGoalResponse(owner, goal ?? this.emptyGoal(year));
  }
  /**
   * Upserts the owner's target for a year and records completion if already-read books meet it.
   */
  public async updateGoal(
    owner: OwnerContext,
    year: number,
    dto: UpdateReadingGoalRequestDto,
  ): Promise<ReadingGoalResponseDto> {
    const completedBooks = await this.countCompletedBooks(owner, year);
    const now = new Date();
    const completedAt = completedBooks >= dto.targetBooks ? now : null;

    const goal = await this.prisma.$transaction(async (transaction) => {
      const updatedGoal = await transaction.readingGoal.upsert({
        create: {
          completedAt,
          targetBooks: dto.targetBooks,
          ...ownerRecord(owner),
          year,
        },
        update: {
          completedAt,
          targetBooks: dto.targetBooks,
        },
        where: this.uniqueGoalWhere(owner, year),
      });

      await this.activityService.emitWithExecutor(transaction, {
        metadata: {
          targetBooks: dto.targetBooks,
          year,
        },
        owner,
        type: ActivityEventType.GOAL_SET,
      });

      if (completedAt) {
        await this.activityService.emitWithExecutor(transaction, {
          metadata: {
            completedBooks,
            targetBooks: dto.targetBooks,
            year,
          },
          owner,
          type: ActivityEventType.GOAL_COMPLETED,
        });
      }

      return updatedGoal;
    });

    return this.toGoalResponse(owner, goal);
  }
  /**
   * Counts books finished inside the UTC calendar year for the owner.
   */
  private async countCompletedBooks(owner: OwnerContext, year: number): Promise<number> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    return this.prisma.libraryItem.count({
      where: {
        dateFinished: {
          gte: start,
          lt: end,
        },
        ...this.ownerWhere(owner),
      },
    });
  }
  /**
   * Provides the default response model before the user saves an explicit target.
   */
  private emptyGoal(year: number): ReadingGoalRecord {
    return {
      completedAt: null,
      id: null,
      targetBooks: 12,
      year,
    };
  }
  /**
   * Adds calculated pace/completion stats to a stored or default goal record.
   */
  private async toGoalResponse(
    owner: OwnerContext,
    goal: ReadingGoalRecord,
  ): Promise<ReadingGoalResponseDto> {
    const completedBooks = await this.countCompletedBooks(owner, goal.year);
    const stats = calculateGoalStats({
      completedBooks,
      now: new Date(),
      targetBooks: goal.targetBooks,
      year: goal.year,
    });

    return {
      completedAt: goal.completedAt?.toISOString() ?? null,
      id: goal.id,
      stats,
      targetBooks: goal.targetBooks,
      year: goal.year,
    };
  }
  /**
   * Converts the current owner context into a Prisma ownership predicate.
   */
  private ownerWhere(owner: OwnerContext): ReturnType<typeof ownerRecord> {
    return ownerRecord(owner);
  }
  /**
   * Selects the compound unique key for user-owned versus guest-owned yearly goals.
   */
  private uniqueGoalWhere(owner: OwnerContext, year: number): Prisma.ReadingGoalWhereUniqueInput {
    return owner.type === 'user'
      ? {
          userId_year: {
            userId: owner.userId,
            year,
          },
        }
      : {
          guestSessionId_year: {
            guestSessionId: owner.guestSessionId,
            year,
          },
        };
  }
}
