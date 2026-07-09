import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decode } from 'jpeg-js';

import {
  createThemePaletteFromRgbaImage,
  isAllowedOpenLibraryCoverUrl,
  type ThemePalette,
} from './theme-palette-rules';

/**
 * Fetches allowed Open Library cover images and extracts constrained app theme palettes from them.
 */
const maxCoverBytes = 1_500_000;

@Injectable()
export class ThemePaletteService {
  private readonly logger = new Logger(ThemePaletteService.name);
  private readonly requestTimeoutMs: number;
  private readonly userAgent: string;
  /**
   * Reads the existing provider timeout/user-agent settings so cover fetches behave like book API
   * calls.
   */
  public constructor(configService: ConfigService) {
    this.requestTimeoutMs = configService.get<number>('OPEN_LIBRARY_REQUEST_TIMEOUT_MS') ?? 8000;
    this.userAgent =
      configService.get<string>('OPEN_LIBRARY_USER_AGENT') ??
      'Bookshelf/0.1.0 (local development; contact: local@example.com)';
  }
  /**
   * Downloads and decodes one Open Library JPEG cover, then derives the light/dark token payload.
   */
  public async createFromCoverUrl(coverUrl: string): Promise<ThemePalette> {
    if (!isAllowedOpenLibraryCoverUrl(coverUrl)) {
      throw new UnprocessableEntityException('Only Open Library cover images can be used.');
    }

    const buffer = await this.fetchCover(coverUrl);

    try {
      const decoded = decode(buffer, { maxMemoryUsageInMB: 32, useTArray: true });
      return createThemePaletteFromRgbaImage({
        data: decoded.data,
        height: decoded.height,
        width: decoded.width,
      });
    } catch (error) {
      this.logger.warn(`Cover palette decode failed: ${describeError(error)}`);
      throw new UnprocessableEntityException('Book cover could not be decoded.');
    }
  }
  /**
   * Fetches the cover with strict type and size checks to avoid accidental arbitrary downloads.
   */
  private async fetchCover(coverUrl: string): Promise<Buffer> {
    let response: Response;

    try {
      response = await fetch(coverUrl, {
        headers: {
          Accept: 'image/jpeg',
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      this.logger.warn(`Cover palette fetch failed: ${describeError(error)}`);
      throw new UnprocessableEntityException('Book cover could not be fetched.');
    }

    if (!response.ok) {
      throw new UnprocessableEntityException('Book cover could not be fetched.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('image/jpeg')) {
      throw new UnprocessableEntityException('Book cover is not a JPEG image.');
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maxCoverBytes) {
      throw new UnprocessableEntityException('Book cover image is too large.');
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxCoverBytes) {
      throw new UnprocessableEntityException('Book cover image is too large.');
    }

    return Buffer.from(arrayBuffer);
  }
}

/**
 * Converts unknown caught values into log-safe messages.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown failure';
}
