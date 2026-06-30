export type GoalStatsInput = {
  completedBooks: number;
  now: Date;
  targetBooks: number;
  year: number;
};

export type GoalStats = {
  booksBehindPace: number;
  completedBooks: number;
  daysElapsed: number;
  daysRemaining: number;
  expectedCompletedByToday: number;
  isComplete: boolean;
  isOnTrack: boolean;
  percentComplete: number;
  remainingBooks: number;
};

export function calculateGoalStats(input: GoalStatsInput): GoalStats {
  const start = Date.UTC(input.year, 0, 1);
  const end = Date.UTC(input.year + 1, 0, 1);
  const now = Math.min(Math.max(input.now.getTime(), start), end);
  const totalDays = Math.max(1, Math.ceil((end - start) / dayMs));
  const daysElapsed = Math.min(totalDays, Math.max(0, Math.floor((now - start) / dayMs) + 1));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const expectedCompletedByToday =
    Math.round((input.targetBooks * daysElapsed * 100) / totalDays) / 100;
  const booksBehindPace = Math.max(0, Math.ceil(expectedCompletedByToday - input.completedBooks));

  return {
    booksBehindPace,
    completedBooks: input.completedBooks,
    daysElapsed,
    daysRemaining,
    expectedCompletedByToday,
    isComplete: input.completedBooks >= input.targetBooks,
    isOnTrack: input.completedBooks >= expectedCompletedByToday,
    percentComplete:
      input.targetBooks > 0
        ? Math.min(100, Math.round((input.completedBooks / input.targetBooks) * 10000) / 100)
        : 100,
    remainingBooks: Math.max(0, input.targetBooks - input.completedBooks),
  };
}

const dayMs = 24 * 60 * 60 * 1000;
