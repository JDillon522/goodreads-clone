import { BadRequestException } from '@nestjs/common';
import { ProgressTrackingMode } from '@prisma/client';

import { calculateProgress, normalizeText } from '../src/library/library-rules';

describe('library rules', () => {
  it('calculates page-based progress and completion from page count', () => {
    expect(
      calculateProgress({
        currentPage: 152,
        pageCount: 304,
        trackingMode: ProgressTrackingMode.PAGE,
      }),
    ).toEqual({
      currentPage: 152,
      currentPercent: 50,
      isComplete: false,
    });

    expect(
      calculateProgress({
        currentPage: 304,
        pageCount: 304,
        trackingMode: ProgressTrackingMode.PAGE,
      }),
    ).toEqual({
      currentPage: 304,
      currentPercent: 100,
      isComplete: true,
    });
  });

  it('rejects page progress beyond known page count', () => {
    expect(() =>
      calculateProgress({
        currentPage: 305,
        pageCount: 304,
        trackingMode: ProgressTrackingMode.PAGE,
      }),
    ).toThrow(BadRequestException);
  });

  it('supports percent-based completion', () => {
    expect(
      calculateProgress({
        currentPercent: 100,
        pageCount: null,
        trackingMode: ProgressTrackingMode.PERCENT,
      }),
    ).toEqual({
      currentPage: null,
      currentPercent: 100,
      isComplete: true,
    });
  });

  it('normalizes title and author text for dedupe fallback rules', () => {
    expect(normalizeText('  The LEFT-Hand_of Darkness!  ')).toBe('the left hand of darkness');
  });
});
