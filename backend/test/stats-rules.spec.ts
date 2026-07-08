import {
  calculateCompletedPageEstimate,
  estimateProgressPages,
  rankValues,
} from '../src/stats/stats-rules';

describe('stats rules', () => {
  it('estimates completed pages from known page counts and completed-page fallback', () => {
    expect(
      calculateCompletedPageEstimate([
        { currentPage: null, pageCount: 300 },
        { currentPage: 180, pageCount: null },
        { currentPage: null, pageCount: null },
      ]),
    ).toEqual({
      averagePagesPerKnownCompletedBook: 240,
      estimatedMissingPageBooks: 1,
      estimatedPagesRead: 720,
      knownCompletedPages: 480,
    });
  });

  it('estimates in-progress pages from page or percent progress', () => {
    expect(estimateProgressPages({ currentPage: 120, currentPercent: null, pageCount: 400 })).toBe(
      120,
    );
    expect(estimateProgressPages({ currentPage: null, currentPercent: 25, pageCount: 400 })).toBe(
      100,
    );
    expect(estimateProgressPages({ currentPage: null, currentPercent: 25, pageCount: null })).toBe(
      0,
    );
  });

  it('ranks non-empty labels by count and name', () => {
    expect(rankValues(['Fantasy', 'Sci-Fi', 'Fantasy', '  ', 'Mystery', 'Sci-Fi'], 2)).toEqual([
      { count: 2, name: 'Fantasy' },
      { count: 2, name: 'Sci-Fi' },
    ]);
  });
});
