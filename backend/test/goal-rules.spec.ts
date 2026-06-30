import { calculateGoalStats } from '../src/goals/goal-rules';

describe('goal rules', () => {
  it('calculates annual goal pace and remaining books', () => {
    expect(
      calculateGoalStats({
        completedBooks: 6,
        now: new Date('2026-07-01T12:00:00.000Z'),
        targetBooks: 12,
        year: 2026,
      }),
    ).toEqual(
      expect.objectContaining({
        booksBehindPace: 0,
        completedBooks: 6,
        isComplete: false,
        isOnTrack: true,
        percentComplete: 50,
        remainingBooks: 6,
      }),
    );
  });

  it('marks completed goals and caps percent at 100', () => {
    expect(
      calculateGoalStats({
        completedBooks: 14,
        now: new Date('2026-12-31T12:00:00.000Z'),
        targetBooks: 12,
        year: 2026,
      }),
    ).toEqual(
      expect.objectContaining({
        isComplete: true,
        percentComplete: 100,
        remainingBooks: 0,
      }),
    );
  });
});
