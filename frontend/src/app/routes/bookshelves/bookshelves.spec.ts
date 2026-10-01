import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import type {
  BookshelfCandidate,
  BookshelfCandidateMatchRequest,
  BookshelfPhotoDetail,
  BookshelfPhotoSummary,
  BookshelfProviderIssue,
} from '../../core/api/api.types';
import { Bookshelves } from '../../core/bookshelves/bookshelves';
import { Library } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { BOOKSHELF_MATCH_REQUEST_SPACING_MS, BookshelvesPage } from './bookshelves';

const bookSummary = {
  authors: ['Ursula K. Le Guin'],
  averageRating: null,
  categories: ['Fiction'],
  coverImages: { card: null, detail: null, theme: null, thumbnail: null },
  coverUrl: null,
  dedupeKey: 'isbn13:9780441478125',
  description: null,
  ebookAccess: null,
  externalLinks: { buy: null, canonical: null, info: null, preview: null, webReader: null },
  genres: ['Fiction'],
  googleBooksVolumeId: 'volume-1',
  isbn10: '0441478123',
  isbn13: '9780441478125',
  isReadableOnline: false,
  language: 'en',
  pageCount: 304,
  primaryAuthor: 'Ursula K. Le Guin',
  printType: 'BOOK',
  providerKey: 'google:volume-1',
  publishedDate: '1969',
  publisher: 'Ace Books',
  ratingsCount: null,
  subtitle: null,
  title: 'The Left Hand of Darkness',
};

const candidate: BookshelfCandidate = {
  book: {
    google: null,
    id: 'book-1',
    summary: bookSummary,
    sync: {
      googleBooksError: null,
      googleBooksStatus: 'SYNCED',
      googleBooksSyncedAt: null,
    },
  },
  classification: 'NEW',
  libraryMatches: [],
  matchScore: 94,
};

class MockBookshelves {
  public readonly list = vi.fn(async (): Promise<BookshelfPhotoSummary[]> => []);
  public readonly image = vi.fn(async () => new Blob(['image'], { type: 'image/webp' }));
  public readonly get = vi.fn(async (): Promise<BookshelfPhotoDetail> => ({
    associatedDetectionCount: 1,
    createdAt: '2026-07-12T00:00:00.000Z',
    detectionCount: 1,
    detections: [
      {
        boundingBox: { height: 600, rotationDegrees: 0, width: 80, x: 100, y: 120 },
        confidence: 92,
        id: 'saved-detection-1',
        libraryItemId: 'item-1',
        observedAuthors: ['Ursula K. Le Guin'],
        observedIsbn10: null,
        observedIsbn13: '9780441478125',
        observedPublisher: 'Ace Books',
        observedSpineText: 'THE LEFT HAND OF DARKNESS',
        observedTitle: 'The Left Hand of Darkness',
        position: 0,
        selectedBook: bookSummary,
        selectedGoogleBooksVolumeId: 'volume-1',
      },
    ],
    id: 'photo-1',
    imageHeight: 800,
    imageWidth: 1200,
    kind: 'SHELF',
    label: 'Office shelf',
    updatedAt: '2026-07-12T00:00:00.000Z',
  }));
  public readonly analyze = vi.fn(async () => ({
    count: 2,
    detections: [
      {
        boundingBox: { height: 800, rotationDegrees: 0, width: 80, x: 100, y: 50 },
        candidates: [],
        confidence: 91,
        id: 'detection-1',
        observedAuthors: ['Ursula K. Le Guin'],
        observedIsbn10: null,
        observedIsbn13: null,
        observedPublisher: null,
        observedSpineText: 'THE LEFT HAND OF DARKNESS',
        observedTitle: 'The Left Hand of Darkness',
        position: 0,
      },
      {
        boundingBox: { height: 760, rotationDegrees: 0, width: 70, x: 200, y: 60 },
        candidates: [],
        confidence: 82,
        id: 'detection-2',
        observedAuthors: [],
        observedIsbn10: null,
        observedIsbn13: null,
        observedPublisher: null,
        observedSpineText: 'UNREADABLE SPINE',
        observedTitle: null,
        position: 1,
      },
    ],
    model: 'gemini-3.5-flash',
    providerIssues: [] as BookshelfProviderIssue[],
  }));
  public readonly match = vi.fn(async (request: BookshelfCandidateMatchRequest) => ({
    candidates: request.detectionId === 'detection-1' ? [candidate] : [],
    detectionId: request.detectionId,
  }));
  public readonly save = vi.fn();
  public readonly search = vi.fn(
    async (): Promise<{ items: BookshelfCandidate[]; query: string }> => ({
      items: [],
      query: '',
    }),
  );
}

class MockLibrary {
  public readonly add = vi.fn();
  public readonly replaceEdition = vi.fn();
}

class MockShelves {
  public readonly list = vi.fn(async () => [
    {
      createdAt: '2026-07-12T00:00:00.000Z',
      deactivatedAt: null,
      id: 'unshelved',
      isDefault: true,
      itemCount: 0,
      name: 'Unshelved',
      position: 0,
      slug: 'unshelved',
      updatedAt: '2026-07-12T00:00:00.000Z',
    },
  ]);
}

describe('BookshelvesPage', () => {
  let api: MockBookshelves;

  beforeEach(async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test-image'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    api = new MockBookshelves();

    await TestBed.configureTestingModule({
      imports: [BookshelvesPage],
      providers: [
        { provide: Bookshelves, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: Library, useClass: MockLibrary },
        { provide: Shelves, useClass: MockShelves },
        { provide: BOOKSHELF_MATCH_REQUEST_SPACING_MS, useValue: 0 },
      ],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps unsupported phone formats out of the analysis request', async () => {
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['heic'], 'shelf.heic', { type: 'image/heic' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    expect(element.textContent).toContain('HEIC and HEIF are not supported yet');
    expect(api.analyze).not.toHaveBeenCalled();
  });

  it('shows live progress while the bookshelf analysis request is pending', async () => {
    const completedResponse = await api.analyze();
    api.analyze.mockClear();
    let completeAnalysis!: (value: typeof completedResponse) => void;
    api.analyze.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeAnalysis = resolve;
        }),
    );
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['jpeg'], 'shelf.jpg', { type: 'image/jpeg' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.scan-dialog .primary-button')!.click();

    await vi.waitFor(() => {
      expect(element.querySelector('.analysis-progress')).not.toBeNull();
    });
    expect(element.querySelector('.analysis-progress')?.getAttribute('aria-busy')).toBe('true');
    expect(element.textContent).toContain('Uploading the photograph securely');

    completeAnalysis(completedResponse);
    await vi.waitFor(() => {
      expect(element.textContent).toContain('Review detected books');
    });
    await fixture.whenStable();
  });

  it('renders detection cards with skeletons before matching candidates one at a time', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    let finishFirstMatch!: (value: {
      candidates: BookshelfCandidate[];
      detectionId: string;
    }) => void;
    api.match.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstMatch = resolve;
        }),
    );
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['jpeg'], 'shelf.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.scan-dialog .primary-button')!.click();
    await vi.waitFor(() => {
      expect(element.textContent).toContain('Review detected books');
    });

    expect(api.analyze).toHaveBeenCalledWith(file);
    expect(api.match).toHaveBeenCalledTimes(1);
    expect(api.match).toHaveBeenCalledWith(
      expect.objectContaining({
        detectionId: 'detection-1',
        observedTitle: 'The Left Hand of Darkness',
      }),
    );
    expect(element.querySelectorAll('.candidate-skeleton')).toHaveLength(6);
    expect(element.textContent).toContain('Review detected books');
    expect(element.textContent).toContain('The Left Hand of Darkness');

    finishFirstMatch({ candidates: [candidate], detectionId: 'detection-1' });
    await vi.waitFor(() => {
      expect(api.match).toHaveBeenCalledTimes(2);
      expect(element.textContent).toContain('94% match');
    });
    await fixture.whenStable();

    expect(element.textContent).toContain('94% match');
    expect(element.textContent).toContain('No reliable Google Books match yet');
    expect(
      [...element.querySelectorAll<HTMLElement>('.detection-group__header h3')].map((heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual(['New', 'Needs review']);
    expect(element.querySelectorAll('.spine-region')).toHaveLength(2);

    element.querySelector<HTMLButtonElement>('.spine-region')!.click();
    await fixture.whenStable();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(element.querySelector('.detection-card.is-active')).not.toBeNull();
  });

  it('shows provider issues only after a client-initiated match returns unavailable', async () => {
    api.match.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.provider-warning')).toBeNull();
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['jpeg'], 'shelf.jpg', { type: 'image/jpeg' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.scan-dialog .primary-button')!.click();
    await fixture.whenStable();

    await vi.waitFor(() => {
      expect(element.querySelector('.provider-warning')?.textContent).toContain(
        'Google Books is temporarily unavailable',
      );
    });
    expect(api.match).toHaveBeenCalledTimes(1);
    expect(element.querySelectorAll('.candidate-match-error')).toHaveLength(2);
  });

  it('opens a linked saved shelf with the requested detection highlighted', async () => {
    api.list.mockResolvedValue([
      {
        associatedDetectionCount: 1,
        createdAt: '2026-07-12T00:00:00.000Z',
        detectionCount: 1,
        id: 'photo-1',
        imageHeight: 800,
        imageWidth: 1200,
        kind: 'SHELF',
        label: 'Office shelf',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    ]);
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          queryParamMap: convertToParamMap({
            detection: 'saved-detection-1',
            photo: 'photo-1',
          }),
        },
      },
    });

    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(api.get).toHaveBeenCalledWith('photo-1');
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(element.querySelectorAll('.saved-photo-layout .spine-region.is-active')).toHaveLength(
        1,
      );
    });
    expect(element.textContent).toContain('Office shelf');
  });

  it('auto-searches for more editions inside the associated detection card', async () => {
    api.search.mockResolvedValue({
      items: [candidate],
      query: 'The Left Hand of Darkness Ursula K. Le Guin',
    });
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['jpeg'], 'shelf.jpg', { type: 'image/jpeg' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.scan-dialog .primary-button')!.click();
    await fixture.whenStable();

    const firstCard = element.querySelector<HTMLElement>('.detection-card')!;
    const moreOptions = [...firstCard.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Search for more options or editions'),
    )!;
    moreOptions.click();

    await vi.waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('The Left Hand of Darkness Ursula K. Le Guin');
    });
    await fixture.whenStable();

    expect(firstCard.querySelector('.manual-search')).not.toBeNull();
    expect(firstCard.textContent).toContain('More options and editions');
    expect(firstCard.textContent).toContain('Ace Books');
  });

  it('reports a Google Books rate limit only after an edition search is attempted', async () => {
    api.search.mockRejectedValue(new HttpErrorResponse({ status: 429 }));
    const fixture = TestBed.createComponent(BookshelvesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.page__header .primary-button')!.click();
    await fixture.whenStable();

    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['jpeg'], 'shelf.jpg', { type: 'image/jpeg' })],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.scan-dialog .primary-button')!.click();
    await fixture.whenStable();
    expect(element.textContent).not.toContain('Google Books rate limit was reached');

    const firstCard = element.querySelector<HTMLElement>('.detection-card')!;
    [...firstCard.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Search for more options or editions'))!
      .click();

    await vi.waitFor(() => {
      expect(firstCard.textContent).toContain('Google Books rate limit was reached');
    });
  });
});
