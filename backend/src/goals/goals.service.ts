import { Injectable } from '@nestjs/common';
import { ActivityEventType } from '@prisma/client';

import { ActivityService } from '../activity/activity.service';
import { OwnerContext } from '../common/owner/owner-context';
import { PrismaService } from '../database/prisma.service';
import { ReadingGoalResponseDto } from './dto/reading-goal-response.dto';
import { UpdateReadingGoalRequestDto } from './dto/update-reading-goal-request.dto';
import { calculateGoalStats } from './goal-rules';

type ReadingGoalRecord = {
  completedAt: Date | null;
  id: string | null;
  targetBooks: number;
  year: number;
};

@Injectable()
export class GoalsService {
  public constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  public async getCurrentGoal(owner: OwnerContext): Promise<ReadingGoalResponseDto> {
    return this.getGoalForYear(owner, new Date().getFullYear());
  }

  public async getGoalForYear(owner: OwnerContext, year: number): Promise<ReadingGoalResponseDto> {
    const goal = await this.prisma.readingGoal.findUnique({
      where: {
        userId_year: {
          userId: owner.userId,
          year,
        },
      },
    });

    return this.toGoalResponse(owner, goal ?? this.emptyGoal(year));
  }

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
          userId: owner.userId,
          year,
        },
        update: {
          completedAt,
          targetBooks: dto.targetBooks,
        },
        where: {
          userId_year: {
            userId: owner.userId,
            year,
          },
        },
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

  private async countCompletedBooks(owner: OwnerContext, year: number): Promise<number> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    return this.prisma.libraryItem.count({
      where: {
        dateFinished: {
          gte: start,
          lt: end,
        },
        userId: owner.userId,
      },
    });
  }

  private emptyGoal(year: number): ReadingGoalRecord {
    return {
      completedAt: null,
      id: null,
      targetBooks: 12,
      year,
    };
  }

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
}
