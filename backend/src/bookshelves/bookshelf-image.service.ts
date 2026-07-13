import { BadRequestException, Injectable } from '@nestjs/common';
import type { Metadata, Sharp, SharpOptions } from 'sharp';

// Sharp is CommonJS at runtime; require avoids a synthetic default that is undefined under Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as (input: Buffer, options?: SharpOptions) => Sharp;

export const maxBookshelfImageBytes = 10 * 1024 * 1024;

export type ValidatedBookshelfImage = {
  buffer: Buffer;
  height: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
};

export type StoredBookshelfImage = ValidatedBookshelfImage & {
  thumbnail: Buffer;
  thumbnailMimeType: 'image/webp';
};

const supportedFormats = new Map([
  ['jpeg', 'image/jpeg' as const],
  ['png', 'image/png' as const],
  ['webp', 'image/webp' as const],
]);

/** Validates upload bytes independently of browser-supplied MIME metadata. */
@Injectable()
export class BookshelfImageService {
  public async validate(file: Express.Multer.File | undefined): Promise<ValidatedBookshelfImage> {
    if (!file) {
      throw new BadRequestException('One bookshelf image is required.');
    }

    if (file.size <= 0 || file.size > maxBookshelfImageBytes) {
      throw new BadRequestException('Bookshelf images must be no larger than 10 MiB.');
    }

    let metadata: Metadata;

    try {
      metadata = await sharp(file.buffer, { animated: false, failOn: 'error' }).metadata();
    } catch {
      throw new BadRequestException(
        'The bookshelf image is invalid. Upload a JPEG, PNG, or WebP file.',
      );
    }

    const mimeType = metadata.format ? supportedFormats.get(metadata.format) : undefined;

    if (!mimeType || !metadata.width || !metadata.height) {
      throw new BadRequestException(
        'Unsupported image format. Upload JPEG, PNG, or WebP; HEIC and HEIF are not supported yet.',
      );
    }

    return {
      buffer: file.buffer,
      height: metadata.height,
      mimeType,
      width: metadata.width,
    };
  }

  /** Produces a compact gallery preview only when the user explicitly saves a photo. */
  public async prepareForStorage(
    file: Express.Multer.File | undefined,
  ): Promise<StoredBookshelfImage> {
    const image = await this.validate(file);

    try {
      const thumbnail = await sharp(image.buffer, { animated: false, failOn: 'error' })
        .rotate()
        .resize({
          fit: 'inside',
          height: 360,
          width: 480,
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();

      return {
        ...image,
        thumbnail,
        thumbnailMimeType: 'image/webp',
      };
    } catch {
      throw new BadRequestException('The bookshelf image could not be prepared for storage.');
    }
  }
}
