import { TestBed } from '@angular/core/testing';

import { Bookshelves } from '../../core/bookshelves/bookshelves';
import { Library } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { BookshelvesPage } from './bookshelves';

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

class MockBookshelves {
  public readonly list = vi.fn(async () => []);
  public readonly image = vi.fn(async () => new Blob(['image'], { type: 'image/webp' }));
  public readonly analyze = vi.fn(async () => ({
    count: 1,
    detections: [
      {
        boundingBox: { height: 800, rotationDegrees: 0, width: 80, x: 100, y: 50 },
        candidates: [
          {
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
          },
        ],
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
    ],
    model: 'gemini-3.5-flash',
  }));
  public readonly save = vi.fn();
  public readonly search = vi.fn();
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
        { provide: Library, useClass: MockLibrary },
        { provide: Shelves, useClass: MockShelves },
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

  it('keeps the dialog open and renders reviewed Google candidates after analysis', async () => {
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
    await fixture.whenStable();

    expect(api.analyze).toHaveBeenCalledWith(file);
    expect(element.textContent).toContain('Review detected books');
    expect(element.textContent).toContain('The Left Hand of Darkness');
    expect(element.textContent).toContain('94% match');
    expect(element.querySelectorAll('.spine-region')).toHaveLength(1);
  });
});
