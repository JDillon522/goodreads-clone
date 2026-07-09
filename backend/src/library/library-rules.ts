import { BadRequestException } from '@nestjs/common';
import { ProgressTrackingMode } from '@prisma/client';

/**
 * Contains pure library-domain rules for progress validation, percentage rounding, and normalized
 * text keys.
 */
export type ProgressRuleInput = {
  currentPage?: number;
  currentPercent?: number;
  pageCount?: null | number;
  trackingMode: ProgressTrackingMode;
};

export type ProgressRuleResult = {
  currentPage: null | number;
  currentPercent: null | number;
  isComplete: boolean;
};
/**
 * Validates and normalizes either page-based or percent-based progress into the stored progress
 * snapshot.
 */
export function calculateProgress(input: ProgressRuleInput): ProgressRuleResult {
  if (input.trackingMode === ProgressTrackingMode.PAGE) {
    if (!input.currentPage) {
      throw new BadRequestException('Current page is required for page-based progress.');
    }

    if (input.pageCount && input.currentPage > input.pageCount) {
      throw new BadRequestException('Current page cannot exceed the book page count.');
    }

    const currentPercent = input.pageCount
      ? roundPercent((input.currentPage / input.pageCount) * 100)
      : null;

    return {
      currentPage: input.currentPage,
      currentPercent,
      isComplete: Boolean(input.pageCount && input.currentPage >= input.pageCount),
    };
  }

  if (input.currentPercent === undefined || input.currentPercent === null) {
    throw new BadRequestException('Current percent is required for percent-based progress.');
  }

  return {
    currentPage: null,
    currentPercent: roundPercent(input.currentPercent),
    isComplete: input.currentPercent >= 100,
  };
}
/**
 * Normalizes title and author strings for duplicate-detection fallback keys.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
/**
 * Rounds percentages to two decimals and clamps them to the accepted 0-100 range.
 */
export function roundPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}
