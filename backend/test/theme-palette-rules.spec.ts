import {
  createThemePaletteFromRgbaImage,
  isAllowedOpenLibraryCoverUrl,
  isThemePalette,
} from '../src/preferences/theme-palette-rules';

describe('theme palette rules', () => {
  it('allows only normalized Open Library cover URLs', () => {
    expect(isAllowedOpenLibraryCoverUrl('https://covers.openlibrary.org/b/id/9255566-L.jpg')).toBe(
      true,
    );
    expect(isAllowedOpenLibraryCoverUrl('https://covers.openlibrary.org/b/isbn/123-L.jpg')).toBe(
      false,
    );
    expect(isAllowedOpenLibraryCoverUrl('https://example.com/b/id/9255566-L.jpg')).toBe(false);
    expect(isAllowedOpenLibraryCoverUrl('not-a-url')).toBe(false);
  });

  it('generates complete light and dark token sets from cover pixels', () => {
    const blue = [20, 110, 170, 255];
    const gold = [212, 145, 24, 255];
    const data = new Uint8Array([...blue, ...blue, ...blue, ...gold, ...gold, ...blue]);
    const palette = createThemePaletteFromRgbaImage({
      data,
      height: 2,
      width: 3,
    });

    expect(isThemePalette(palette)).toBe(true);
    expect(palette.light['--color-bg-primary']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.dark['--color-bg-primary']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.light['--color-surface']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.dark['--color-surface']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.light['--color-accent']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.dark['--color-accent']).toMatch(/^#[0-9a-f]{6}$/);
    expect(palette.light['--color-bg-primary']).not.toBe(palette.dark['--color-bg-primary']);
    expect(palette.light['--color-accent']).not.toBe(palette.dark['--color-accent']);
    expect(palette.light['--color-rating']).not.toBe(palette.light['--color-progress']);
  });
});
