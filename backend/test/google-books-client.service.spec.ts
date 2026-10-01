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

  afterEach(() => jest.useRealTimers());

  it('maps provider outages to service unavailable', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(null, { status: 503 })));

    const request = service.searchVolumes({
      maxResults: 10,
      orderBy: 'relevance',
      printType: 'books',
      query: 'dune',
      startIndex: 0,
    });
    const expectation = expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);

    await jest.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('preserves quota and missing-volume status codes', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const quotaRequest = service.searchVolumes({
      maxResults: 10,
      orderBy: 'relevance',
      printType: 'books',
      query: 'dune',
      startIndex: 0,
    });
    const quotaExpectation = expect(quotaRequest).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    await jest.runAllTimersAsync();
    await quotaExpectation;
    await expect(service.getVolume('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries transient provider failures and honors Retry-After', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { errors: [{ reason: 'backendFailed' }] } }), {
          headers: { 'Retry-After': '1' },
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], totalItems: 0 }), { status: 200 }),
      );

    const request = service.searchVolumes({
      maxResults: 10,
      orderBy: 'relevance',
      printType: 'books',
      query: 'dune',
      startIndex: 0,
    });
    const expectation = expect(request).resolves.toEqual(
      expect.objectContaining({ items: [], totalItems: 0 }),
    );

    await jest.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
