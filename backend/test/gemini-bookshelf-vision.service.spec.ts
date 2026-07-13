import {
  HttpException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GeminiBookshelfVisionService } from '../src/bookshelves/gemini-bookshelf-vision.service';

describe('GeminiBookshelfVisionService', () => {
  const config = (key = 'test-key', overrides: Record<string, unknown> = {}) =>
    ({
      get: jest.fn((name: string) => {
        const values: Record<string, unknown> = {
          GEMINI_API_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/',
          GEMINI_API_KEY: key,
          GEMINI_MODEL: 'gemini-3.5-flash',
          GEMINI_REQUEST_TIMEOUT_MS: 90_000,
          NODE_ENV: 'test',
          ...overrides,
        };
        return values[name];
      }),
    }) as unknown as ConfigService;
  const image = {
    buffer: Buffer.from('image-bytes'),
    height: 800,
    mimeType: 'image/jpeg' as const,
    width: 1200,
  };

  afterEach(() => jest.restoreAllMocks());

  it('uses stateless Gemini image input with structured JSON output', async () => {
    const output = JSON.stringify({
      books: [
        {
          authors: ['Ursula K. Le Guin'],
          bounding_box: {
            height: 800,
            rotation_degrees: 0,
            width: 80,
            x: 100,
            y: 80,
          },
          confidence: 92,
          isbn10: null,
          isbn13: null,
          publisher: null,
          spine_text: 'THE LEFT HAND OF DARKNESS',
          title: 'The Left Hand of Darkness',
        },
      ],
    });
    const splitAt = Math.floor(output.length / 2);
    const stream = [
      'event: interaction.created',
      `data: ${JSON.stringify({
        event_type: 'interaction.created',
        interaction: { model: 'gemini-3.5-flash', status: 'in_progress' },
      })}`,
      '',
      'event: step.start',
      `data: ${JSON.stringify({
        event_type: 'step.start',
        index: 0,
        step: { type: 'model_output' },
      })}`,
      '',
      'event: step.delta',
      `data: ${JSON.stringify({
        delta: { text: output.slice(0, splitAt), type: 'text' },
        event_type: 'step.delta',
        index: 0,
      })}`,
      '',
      'event: step.delta',
      `data: ${JSON.stringify({
        delta: { text: output.slice(splitAt), type: 'text' },
        event_type: 'step.delta',
        index: 0,
      })}`,
      '',
      'event: interaction.completed',
      `data: ${JSON.stringify({
        event_type: 'interaction.completed',
        interaction: { status: 'completed' },
      })}`,
      '',
      'event: done',
      'data: [DONE]',
      '',
    ].join('\n');
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(stream, { headers: { 'Content-Type': 'text/event-stream' }, status: 200 }),
      );
    const service = new GeminiBookshelfVisionService(config());

    await expect(service.analyze(image)).resolves.toEqual([
      expect.objectContaining({
        confidence: 92,
        spineText: 'THE LEFT HAND OF DARKNESS',
        title: 'The Left Hand of Darkness',
        x: 100,
      }),
    ]);

    const [url, request] = fetchMock.mock.calls[0];
    expect(typeof request?.body).toBe('string');
    const body = JSON.parse(request?.body as string) as Record<string, unknown>;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request?.headers).toEqual(
      expect.objectContaining({ Accept: 'text/event-stream', 'x-goog-api-key': 'test-key' }),
    );
    expect(body['model']).toBe('gemini-3.5-flash');
    expect(body['store']).toBe(false);
    expect(body['stream']).toBe(true);
    expect(body['generation_config']).toEqual({ max_output_tokens: 32_000 });
    expect(body['response_format']).toEqual(
      expect.objectContaining({ mime_type: 'application/json', type: 'text' }),
    );
    expect(JSON.stringify(body)).toContain('"type":"image"');
    expect(JSON.stringify(body)).toContain('"mime_type":"image/jpeg"');
    expect(JSON.stringify(body)).toContain(image.buffer.toString('base64'));
    expect(JSON.stringify(body)).not.toMatch(/"(?:minimum|maximum|maxItems)"/);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini stream line: data:'));
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini response dump:'));
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Gemini concatenated model output:\n${output}`),
    );
  });

  it('fails without making a request when the API key is missing', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const service = new GeminiBookshelfVisionService(config(''));
    await expect(service.analyze(image)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes raw response lines and the concatenated model output to a trace file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bookshelf-gemini-stream-'));
    const logPath = join(directory, 'gemini-bookshelf-stream.log');
    const output = JSON.stringify({
      books: [
        {
          authors: [],
          bounding_box: { height: 900, rotation_degrees: 0, width: 50, x: 20, y: 50 },
          confidence: 80,
          isbn10: null,
          isbn13: null,
          publisher: null,
          spine_text: 'DUNE',
          title: 'Dune',
        },
      ],
    });
    const responseBody = JSON.stringify({
      status: 'completed',
      steps: [{ content: [{ text: output, type: 'text' }], type: 'model_output' }],
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(responseBody, { status: 200 }));

    try {
      await new GeminiBookshelfVisionService(
        config('test-key', {
          GEMINI_STREAM_LOG_PATH: logPath,
          NODE_ENV: 'development',
        }),
      ).analyze(image);

      const trace = await readFile(logPath, 'utf8');
      expect(trace).toContain(`STREAM ${responseBody}`);
      expect(trace).toContain(`----- CONCATENATED MODEL OUTPUT -----\n${output}`);
      expect(trace).toContain('PARSED detections=1');
      expect(trace).toContain('SUCCESS detections=1');
      expect(trace).toContain('END');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('maps rate limits and safety blocks to stable public errors', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await expect(new GeminiBookshelfVisionService(config()).analyze(image)).rejects.toBeInstanceOf(
      HttpException,
    );

    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'blocked', steps: [] }), { status: 200 }),
      );
    await expect(new GeminiBookshelfVisionService(config()).analyze(image)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('maps invalid credentials to a configuration error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            details: [{ reason: 'API_KEY_INVALID' }],
            status: 'INVALID_ARGUMENT',
          },
        }),
        { status: 400 },
      ),
    );
    await expect(new GeminiBookshelfVisionService(config()).analyze(image)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects malformed structured output', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'completed',
          steps: [{ content: [{ text: '{"wrong":true}', type: 'text' }], type: 'model_output' }],
        }),
        { status: 200 },
      ),
    );
    await expect(new GeminiBookshelfVisionService(config()).analyze(image)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
