import { canDeleteShelf, isDefaultShelfSlug, slugifyShelfName } from '../src/shelves/shelf-rules';

describe('shelf rules', () => {
  it('locks deletion for Unshelved only', () => {
    expect(canDeleteShelf('unshelved')).toBe(false);
    expect(canDeleteShelf('want-to-read')).toBe(true);
    expect(canDeleteShelf('fantasy')).toBe(true);
  });

  it('identifies core shelf slugs', () => {
    expect(isDefaultShelfSlug('want-to-read')).toBe(true);
    expect(isDefaultShelfSlug('currently-reading')).toBe(true);
    expect(isDefaultShelfSlug('read')).toBe(true);
    expect(isDefaultShelfSlug('unshelved')).toBe(true);
    expect(isDefaultShelfSlug('favorites')).toBe(false);
  });

  it('slugifies custom shelf names', () => {
    expect(slugifyShelfName('  Award Winners + Weird Stuff  ')).toBe('award-winners-weird-stuff');
  });
});
