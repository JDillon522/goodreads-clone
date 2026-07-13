import { BadRequestException } from '@nestjs/common';
import { encode } from 'jpeg-js';

import { BookshelfImageService } from '../src/bookshelves/bookshelf-image.service';

describe('BookshelfImageService', () => {
  const service = new BookshelfImageService();

  it('validates real bytes and generates a compact WebP thumbnail', async () => {
    const width = 90;
    const height = 60;
    const pixels = Buffer.alloc(width * height * 4, 80);
    const buffer = encode({ data: pixels, height, width }, 80).data;
    const file = {
      buffer,
      mimetype: 'application/octet-stream',
      originalname: 'shelf.jpg',
      size: buffer.length,
    } as Express.Multer.File;

    await expect(service.prepareForStorage(file)).resolves.toEqual(
      expect.objectContaining({
        height,
        mimeType: 'image/jpeg',
        thumbnail: expect.any(Buffer),
        thumbnailMimeType: 'image/webp',
        width,
      }),
    );
  });

  it('rejects missing, fake, and oversized files', async () => {
    await expect(service.validate(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.validate({ buffer: Buffer.from('not-image'), size: 9 } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.validate({
        buffer: Buffer.alloc(1),
        size: 10 * 1024 * 1024 + 1,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
