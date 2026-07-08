export type CompletedPageEstimateInput = {
  currentPage?: null | number;
  pageCount: null | number;
};

export type CompletedPageEstimate = {
  averagePagesPerKnownCompletedBook: number;
  estimatedMissingPageBooks: number;
  estimatedPagesRead: number;
  knownCompletedPages: number;
};

export type ProgressPageEstimateInput = {
  currentPage?: null | number;
  currentPercent?: null | number;
  pageCount: null | number;
};

export type RankedValue = {
  count: number;
  name: string;
};

export function calculateCompletedPageEstimate(
  items: CompletedPageEstimateInput[],
): CompletedPageEstimate {
  const knownPages = items
    .map((item) => item.pageCount ?? null)
    .filter((pageCount): pageCount is number => typeof pageCount === 'number' && pageCount > 0);
  const fallbackPages = items
    .filter(
      (item) => !item.pageCount && typeof item.currentPage === 'number' && item.currentPage > 0,
    )
    .map((item) => item.currentPage ?? 0);
  const knownCompletedPages =
    knownPages.reduce((total, pageCount) => total + pageCount, 0) +
    fallbackPages.reduce((total, pageCount) => total + pageCount, 0);
  const knownBookCount = knownPages.length + fallbackPages.length;
  const estimatedMissingPageBooks = items.length - knownBookCount;
  const averagePagesPerKnownCompletedBook =
    knownBookCount > 0 ? Math.round(knownCompletedPages / knownBookCount) : 0;

  return {
    averagePagesPerKnownCompletedBook,
    estimatedMissingPageBooks,
    estimatedPagesRead:
      knownCompletedPages + estimatedMissingPageBooks * averagePagesPerKnownCompletedBook,
    knownCompletedPages,
  };
}

export function estimateProgressPages(item: ProgressPageEstimateInput): number {
  if (typeof item.currentPage === 'number' && item.currentPage > 0) {
    return Math.round(item.currentPage);
  }

  if (
    typeof item.currentPercent === 'number' &&
    item.currentPercent > 0 &&
    typeof item.pageCount === 'number' &&
    item.pageCount > 0
  ) {
    return Math.round((item.pageCount * item.currentPercent) / 100);
  }

  return 0;
}

export function rankValues(values: readonly string[], limit = 8): RankedValue[] {
  const counts = new Map<string, number>();

  for (const rawValue of values) {
    const value = rawValue.trim();

    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}
