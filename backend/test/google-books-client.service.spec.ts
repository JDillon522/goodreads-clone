import { HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleBooksClientService } from '../src/books/google-books/google-books-client.service';

describe('GoogleBooksClientService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'GOOGLE_BOOKS_BASE_URL') {
        return 'https://www.googleapis.com/books/v1';
      }

      if (key === 'GOOGLE_BOOKS_REQUEST_TIMEOUT_MS') {
        return 1000;
      }

      return undefined;
    }),
  } as unknown as ConfigService;
  let service: GoogleBooksClientService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new GoogleBooksClientService(config);
  });

  it('maps provider outages to service unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      service.searchVolumes({
        maxResults: 10,
        orderBy: 'relevance',
        printType: 'books',
        query: 'dune',
        startIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('preserves quota and missing-volume status codes', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      service.searchVolumes({
        maxResults: 10,
        orderBy: 'relevance',
        printType: 'books',
        query: 'dune',
        startIndex: 0,
      }),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(service.getVolume('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
