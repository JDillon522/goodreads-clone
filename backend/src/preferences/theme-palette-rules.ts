/**
 * Converts decoded cover pixels into constrained light/dark CSS token sets. The generated palette
 * controls accent colors plus low-tint background/surface colors so cover art can shape the app
 * atmosphere without damaging readable text contrast.
 */
export type ThemeCssVariable =
  | '--color-bg-primary'
  | '--color-bg-secondary'
  | '--color-bg-tertiary'
  | '--color-surface'
  | '--color-surface-raised'
  | '--color-border'
  | '--color-border-subtle'
  | '--color-accent'
  | '--color-accent-hover'
  | '--color-accent-muted'
  | '--color-accent-subtle'
  | '--color-focus-ring'
  | '--color-highlight'
  | '--color-highlight-subtle'
  | '--color-on-accent'
  | '--color-on-highlight'
  | '--color-progress'
  | '--color-rating';

export type ThemePaletteTokenSet = Record<ThemeCssVariable, string>;

export type ThemePalette = {
  dark: ThemePaletteTokenSet;
  light: ThemePaletteTokenSet;
};

export type RgbaImage = {
  data: ArrayLike<number>;
  height: number;
  width: number;
};

type Hsl = {
  h: number;
  l: number;
  s: number;
};

type Rgb = {
  b: number;
  g: number;
  r: number;
};

type Swatch = Rgb & {
  count: number;
  hsl: Hsl;
  score: number;
};

export const themeCssVariables: readonly ThemeCssVariable[] = [
  '--color-bg-primary',
  '--color-bg-secondary',
  '--color-bg-tertiary',
  '--color-surface',
  '--color-surface-raised',
  '--color-border',
  '--color-border-subtle',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-subtle',
  '--color-accent-muted',
  '--color-on-accent',
  '--color-focus-ring',
  '--color-highlight',
  '--color-highlight-subtle',
  '--color-on-highlight',
  '--color-progress',
  '--color-rating',
];

/**
 * Restricts palette extraction to normalized provider cover URL shapes used by Bookshelf.
 */
export function isAllowedGoogleBooksCoverUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }

  if (url.hostname === 'books.google.com') {
    return url.pathname === '/books/content';
  }

  return (
    url.hostname === 'books.googleusercontent.com' ||
    url.hostname.endsWith('.googleusercontent.com')
  );
}

/**
 * Builds a paired light/dark theme palette from decoded RGBA pixels.
 */
export function createThemePaletteFromRgbaImage(image: RgbaImage): ThemePalette {
  const [accent, highlight] = chooseSourceColors(image);
  const accentHsl = rgbToHsl(accent);
  const highlightHsl = rgbToHsl(highlight);
  const lightAccent = hslToRgb({
    h: accentHsl.h,
    l: clamp(accentHsl.l, 0.28, 0.38),
    s: clamp(accentHsl.s, 0.44, 0.72),
  });
  const lightAccentHover = hslToRgb({
    h: accentHsl.h,
    l: clamp(accentHsl.l - 0.1, 0.2, 0.3),
    s: clamp(accentHsl.s, 0.48, 0.76),
  });
  const lightHighlight = hslToRgb({
    h: highlightHsl.h,
    l: clamp(highlightHsl.l, 0.38, 0.5),
    s: clamp(highlightHsl.s, 0.5, 0.78),
  });
  const darkAccent = hslToRgb({
    h: accentHsl.h,
    l: clamp(accentHsl.l + 0.25, 0.66, 0.78),
    s: clamp(accentHsl.s, 0.5, 0.82),
  });
  const darkAccentHover = hslToRgb({
    h: accentHsl.h,
    l: clamp(accentHsl.l + 0.34, 0.76, 0.86),
    s: clamp(accentHsl.s, 0.48, 0.82),
  });
  const darkHighlight = hslToRgb({
    h: highlightHsl.h,
    l: clamp(highlightHsl.l + 0.22, 0.62, 0.76),
    s: clamp(highlightHsl.s, 0.52, 0.84),
  });

  return {
    dark: buildTokenSet({
      accent: darkAccent,
      accentHover: darkAccentHover,
      accentMuted: mix(darkAccent, hexToRgb('#070d0c'), 0.17),
      accentSubtle: mix(darkAccent, hexToRgb('#070d0c'), 0.25),
      backgroundPrimary: mix(darkAccent, hexToRgb('#070d0c'), 0.08),
      backgroundSecondary: mix(darkAccent, hexToRgb('#0d1715'), 0.12),
      backgroundTertiary: mix(darkHighlight, mix(darkAccent, hexToRgb('#17221f'), 0.12), 0.08),
      border: mix(darkAccent, hexToRgb('#294039'), 0.16),
      borderSubtle: mix(darkAccent, hexToRgb('#1e302b'), 0.12),
      focusAlpha: 0.28,
      highlight: darkHighlight,
      highlightSubtle: mix(darkHighlight, hexToRgb('#070d0c'), 0.22),
      onAccent: '#031116',
      onHighlight: '#160d00',
      surface: mix(darkAccent, hexToRgb('#101a18'), 0.1),
      surfaceRaised: mix(darkHighlight, hexToRgb('#14211e'), 0.08),
    }),
    light: buildTokenSet({
      accent: lightAccent,
      accentHover: lightAccentHover,
      accentMuted: mix(lightAccent, hexToRgb('#ffffff'), 0.08),
      accentSubtle: mix(lightAccent, hexToRgb('#ffffff'), 0.16),
      backgroundPrimary: mix(lightAccent, hexToRgb('#f4f7f5'), 0.06),
      backgroundSecondary: mix(lightAccent, hexToRgb('#e8efeb'), 0.09),
      backgroundTertiary: mix(lightHighlight, mix(lightAccent, hexToRgb('#dbe6e1'), 0.08), 0.08),
      border: mix(lightAccent, hexToRgb('#c9d7d1'), 0.12),
      borderSubtle: mix(lightAccent, hexToRgb('#e0e8e4'), 0.08),
      focusAlpha: 0.24,
      highlight: lightHighlight,
      highlightSubtle: mix(lightHighlight, hexToRgb('#ffffff'), 0.15),
      onAccent: '#ffffff',
      onHighlight: '#1f1300',
      surface: mix(lightAccent, hexToRgb('#ffffff'), 0.03),
      surfaceRaised: mix(lightHighlight, hexToRgb('#fbfdfc'), 0.04),
    }),
  };
}

/**
 * Performs a runtime shape check before trusting palette JSON read from Prisma.
 */
export function isThemePalette(value: unknown): value is ThemePalette {
  if (!isRecord(value) || !isRecord(value.light) || !isRecord(value.dark)) {
    return false;
  }

  const light = value.light;
  const dark = value.dark;

  return (
    themeCssVariables.every((variable) => typeof light[variable] === 'string') &&
    themeCssVariables.every((variable) => typeof dark[variable] === 'string')
  );
}

/**
 * Converts palette JSON into the typed palette shape or null when older data is malformed.
 */
export function normalizeThemePalette(value: unknown): null | ThemePalette {
  return isThemePalette(value) ? value : null;
}

/**
 * Chooses a colorful dominant accent plus a second hue for ratings/highlights.
 */
function chooseSourceColors(image: RgbaImage): [Rgb, Rgb] {
  const swatches = collectSwatches(image);

  if (swatches.length === 0) {
    return [hexToRgb('#007a5e'), hexToRgb('#c98209')];
  }

  const accent = swatches[0];
  const highlight =
    swatches.find((swatch) => hueDistance(swatch.hsl.h, accent.hsl.h) >= 34) ??
    hslToRgb({
      h: (accent.hsl.h + 48) % 360,
      l: clamp(accent.hsl.l + 0.08, 0.34, 0.58),
      s: clamp(accent.hsl.s, 0.42, 0.82),
    });

  return [accent, highlight];
}

/**
 * Quantizes pixels so cover images produce stable color candidates instead of one-off pixel noise.
 */
function collectSwatches(image: RgbaImage): Swatch[] {
  const buckets = new Map<string, { b: number; count: number; g: number; r: number }>();
  const pixelCount = Math.max(image.width * image.height, 1);
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 7000)));

  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const offset = (y * image.width + x) * 4;
      const alpha = image.data[offset + 3] ?? 255;

      if (alpha < 128) {
        continue;
      }

      const r = image.data[offset] ?? 0;
      const g = image.data[offset + 1] ?? 0;
      const b = image.data[offset + 2] ?? 0;
      const hsl = rgbToHsl({ b, g, r });

      if (hsl.l < 0.06 || hsl.l > 0.94) {
        continue;
      }

      const key = `${quantize(r)}:${quantize(g)}:${quantize(b)}`;
      const current = buckets.get(key) ?? { b: 0, count: 0, g: 0, r: 0 };
      current.count += 1;
      current.r += r;
      current.g += g;
      current.b += b;
      buckets.set(key, current);
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const rgb = {
        b: Math.round(bucket.b / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        r: Math.round(bucket.r / bucket.count),
      };
      const hsl = rgbToHsl(rgb);
      const lightnessBalance = 1 - Math.abs(hsl.l - 0.48);

      return {
        ...rgb,
        count: bucket.count,
        hsl,
        score: bucket.count * (0.55 + hsl.s) * Math.max(lightnessBalance, 0.2),
      };
    })
    .sort((left, right) => right.score - left.score);
}

/**
 * Builds CSS variable tokens from final light or dark accent decisions.
 */
function buildTokenSet(input: {
  accent: Rgb;
  accentHover: Rgb;
  accentMuted: Rgb;
  accentSubtle: Rgb;
  backgroundPrimary: Rgb;
  backgroundSecondary: Rgb;
  backgroundTertiary: Rgb;
  border: Rgb;
  borderSubtle: Rgb;
  focusAlpha: number;
  highlight: Rgb;
  highlightSubtle: Rgb;
  onAccent: string;
  onHighlight: string;
  surface: Rgb;
  surfaceRaised: Rgb;
}): ThemePaletteTokenSet {
  return {
    '--color-bg-primary': rgbToHex(input.backgroundPrimary),
    '--color-bg-secondary': rgbToHex(input.backgroundSecondary),
    '--color-bg-tertiary': rgbToHex(input.backgroundTertiary),
    '--color-surface': rgbToHex(input.surface),
    '--color-surface-raised': rgbToHex(input.surfaceRaised),
    '--color-border': rgbToHex(input.border),
    '--color-border-subtle': rgbToHex(input.borderSubtle),
    '--color-accent': rgbToHex(input.accent),
    '--color-accent-hover': rgbToHex(input.accentHover),
    '--color-accent-muted': rgbToHex(input.accentMuted),
    '--color-accent-subtle': rgbToHex(input.accentSubtle),
    '--color-focus-ring': `rgba(${input.accent.r}, ${input.accent.g}, ${input.accent.b}, ${input.focusAlpha})`,
    '--color-highlight': rgbToHex(input.highlight),
    '--color-highlight-subtle': rgbToHex(input.highlightSubtle),
    '--color-on-accent': input.onAccent,
    '--color-on-highlight': input.onHighlight,
    '--color-progress': rgbToHex(input.accent),
    '--color-rating': rgbToHex(input.highlight),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): Rgb {
  return {
    b: Number.parseInt(hex.slice(5, 7), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    r: Number.parseInt(hex.slice(1, 3), 16),
  };
}

function hslToRgb(hsl: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * hsl.l - 1)) * hsl.s;
  const huePrime = hsl.h / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const lightnessMatch = hsl.l - chroma / 2;
  const [r, g, b] =
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return {
    b: Math.round((b + lightnessMatch) * 255),
    g: Math.round((g + lightnessMatch) * 255),
    r: Math.round((r + lightnessMatch) * 255),
  };
}

function hueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mix(foreground: Rgb, background: Rgb, foregroundWeight: number): Rgb {
  const backgroundWeight = 1 - foregroundWeight;

  return {
    b: Math.round(foreground.b * foregroundWeight + background.b * backgroundWeight),
    g: Math.round(foreground.g * foregroundWeight + background.g * backgroundWeight),
    r: Math.round(foreground.r * foregroundWeight + background.r * backgroundWeight),
  };
}

function quantize(value: number): number {
  return Math.round(value / 32) * 32;
}

function rgbToHex(rgb: Rgb): string {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, l: lightness, s: 0 };
  }

  const delta = max - min;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r
      ? 60 * (((g - b) / delta) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);

  return {
    h: (hue + 360) % 360,
    l: lightness,
    s: saturation,
  };
}

function toHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}
