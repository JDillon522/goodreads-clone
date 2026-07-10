import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, minLength, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import type {
  BookSearchFacets,
  BookSearchFilters,
  BookSearchValueFacet,
  NormalizedBook,
  ShelfResponse,
} from '../../core/api/api.types';
import { Books, type BookSearchRequestFilters } from '../../core/books/books';
import { Library as LibraryService } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

/**
 * Search route controller for Google Books discovery.
 *
 * The URL is the source of truth for query text, page, and filters so browser
 * refresh, pagination, author links, and shared URLs all rehydrate the same
 * server-backed search state.
 */
const emptyFacets: BookSearchFacets = {
  availability: [],
  printTypes: [],
  sortOptions: [],
};
const emptyFilters: BookSearchFilters = {
  filter: null,
  orderBy: 'relevance',
  printType: 'books',
};

@Component({
  selector: 'app-search',
  imports: [UiFormControl],
  templateUrl: './search.html',
  styleUrl: './search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  private readonly addBookDialog = viewChild<ElementRef<HTMLDialogElement>>('addBookDialog');
  private readonly books = inject(Books);
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);
  private readonly model = signal({ query: '' });
  private readonly shelfPickerModel = signal({ shelfId: '' });
  private lastQueryParamSearch = '';

  protected readonly results = signal<NormalizedBook[]>([]);
  protected readonly facets = signal<BookSearchFacets>(emptyFacets);
  protected readonly activeFilters = signal<BookSearchFilters>(emptyFilters);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly selectedBook = signal<NormalizedBook | null>(null);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly addingKey = signal<string | null>(null);
  protected readonly openingKey = signal<string | null>(null);
  protected readonly isSearching = signal(false);
  protected readonly isLoadingShelves = signal(true);
  protected readonly pageSize = 10;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize)),
  );
  protected readonly resultRangeStart = computed(() => {
    if (this.results().length === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize + 1;
  });
  protected readonly resultRangeEnd = computed(() => {
    if (this.results().length === 0) {
      return 0;
    }

    return Math.min(this.resultRangeStart() + this.results().length - 1, this.total());
  });
  protected readonly canGoPrevious = computed(() => this.currentPage() > 1 && !this.isSearching());
  protected readonly canGoNext = computed(
    () => this.currentPage() < this.totalPages() && !this.isSearching(),
  );
  protected readonly hasActiveFilters = computed(() => {
    const filters = this.activeFilters();

    return Boolean(
      filters.filter || filters.orderBy !== 'relevance' || filters.printType !== 'books',
    );
  });
  protected readonly hasFilterOptions = computed(() => {
    const facets = this.facets();

    return (
      facets.availability.length > 0 ||
      facets.printTypes.length > 0 ||
      facets.sortOptions.length > 0
    );
  });
  protected readonly searchForm = form(this.model, (path) => {
    required(path.query, { message: 'Search terms are required.' });
    minLength(path.query, 2, { message: 'Use at least 2 characters.' });
  });
  protected readonly shelfPickerForm = form(this.shelfPickerModel, (path) => {
    required(path.shelfId, { message: 'Choose a shelf.' });
  });
  /**
   * Watches shelf revisions for the add-to-library dialog and query params for search state.
   *
   * Empty query params reset the screen to its first-load state. Non-empty query
   * params are normalized into the backend search request and deduplicated so
   * Angular router emissions do not refetch the same result set.
   */
  public constructor() {
    effect(() => {
      this.shelvesService.version();
      void this.loadShelves();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = params.get('query')?.trim() ?? '';
      const page = this.normalizePage(params.get('page'));
      const filters = this.filtersFromParams(params);

      if (!query) {
        this.lastQueryParamSearch = '';
        this.model.set({ query: '' });
        this.activeFilters.set(emptyFilters);
        this.facets.set(emptyFacets);
        this.currentPage.set(1);
        this.results.set([]);
        this.total.set(0);
        this.error.set(null);
        this.status.set(null);
        return;
      }

      // Router emissions can repeat after navigation merges params; this key keeps
      // effects and form writes from causing duplicate Google Books calls.
      const searchKey = JSON.stringify({ filters, page, query });

      if (searchKey === this.lastQueryParamSearch) {
        return;
      }

      this.lastQueryParamSearch = searchKey;
      this.model.set({ query });
      this.activeFilters.set(this.responseFiltersFromRequest(filters));
      this.currentPage.set(page);
      void this.searchCurrentQuery(query, page, filters);
    });
  }
  /**
   * Validates the search text and writes it to the URL, which then triggers the actual fetch.
   */
  protected async submitSearch(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.status.set(null);

    const successful = await submit(this.searchForm, async (formTree) => {
      await this.navigateToSearch(
        formTree().value().query.trim(),
        1,
        this.filtersFromCurrentState(),
      );
    });

    if (!successful) {
      this.error.set('Search failed.');
    }
  }
  /**
   * Moves between result pages while preserving active filters from current state.
   */
  protected async goToPage(page: number): Promise<void> {
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, page);
  }
  /**
   * Applies the Google Books availability filter and resets pagination.
   */
  protected async applyAvailabilityFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      filter:
        facet.value === 'all' || this.activeFilters().filter === facet.value
          ? undefined
          : (facet.value as BookSearchRequestFilters['filter']),
    });
  }
  /**
   * Applies the Google Books print-type control and resets pagination.
   */
  protected async applyPrintTypeFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      printType: facet.value as BookSearchRequestFilters['printType'],
    });
  }
  /**
   * Applies Google Books result ordering and resets pagination.
   */
  protected async applySortOption(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      orderBy: facet.value as BookSearchRequestFilters['orderBy'],
    });
  }
  /**
   * Removes all filter params while keeping the current search text.
   */
  protected async clearFilters(): Promise<void> {
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, 1, {});
  }
  /**
   * Marks the selected availability chip active, treating null as the "all" option.
   */
  protected isAvailabilityActive(facet: BookSearchValueFacet): boolean {
    return facet.value === 'all'
      ? this.activeFilters().filter === null
      : this.activeFilters().filter === facet.value;
  }
  /**
   * Marks the selected print-type chip active.
   */
  protected isPrintTypeActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().printType === facet.value;
  }
  /**
   * Marks the selected sort chip active.
   */
  protected isSortActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().orderBy === facet.value;
  }
  /**
   * Opens the add dialog with a valid shelf selection before the user submits.
   */
  protected openAddBookDialog(book: NormalizedBook): void {
    if (!this.canSaveBook(book)) {
      this.error.set('This Google Books result is missing an ISBN and cannot be saved.');
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.selectedBook.set(book);
    this.ensureSelectedShelf();
    this.addBookDialog()?.nativeElement.showModal();
  }
  /**
   * Opens the info-only Google Books detail page without adding the book to the library.
   */
  protected async openBookDetail(book: NormalizedBook): Promise<void> {
    if (this.openingKey()) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.openingKey.set(this.bookKey(book));

    try {
      const volumeId =
        book.summary.googleBooksVolumeId ?? googleVolumeIdFromProviderKey(book.summary.providerKey);

      if (!volumeId) {
        throw new Error('Missing Google Books volume id.');
      }

      await this.router.navigate(['/app/book-info/google', volumeId]);
    } catch {
      this.error.set('That book could not be opened.');
    } finally {
      this.openingKey.set(null);
    }
  }
  /**
   * Clears the transient selected book when the modal closes.
   */
  protected closeAddBookDialog(): void {
    this.addBookDialog()?.nativeElement.close();
    this.selectedBook.set(null);
  }
  /**
   * Adds the selected search result to the chosen shelf and shows per-book pending state.
   */
  protected async submitAddBook(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const book = this.selectedBook();

    if (!book) {
      return;
    }

    this.error.set(null);
    this.status.set(null);
    this.addingKey.set(this.bookKey(book));

    try {
      const successful = await submit(this.shelfPickerForm, async (formTree) => {
        await this.library.add({
          googleBooksVolumeId: book.summary.googleBooksVolumeId,
          isbn10: book.summary.isbn10,
          isbn13: book.summary.isbn13,
          shelfId: formTree().value().shelfId,
        });
        this.status.set(`${book.summary.title} was added to your library.`);
        this.closeAddBookDialog();
      });

      if (!successful) {
        this.error.set('That book could not be added.');
      }
    } catch {
      this.error.set('That book could not be added.');
    } finally {
      this.addingKey.set(null);
    }
  }
  /**
   * Returns a usable cover URL only when the provider supplied one.
   */
  protected coverUrl(book: NormalizedBook): string | null {
    return book.summary.coverImages.card ?? book.summary.coverUrl ?? null;
  }
  /**
   * Chooses the normalized primary author, falling back to the first author label.
   */
  protected primaryAuthor(book: NormalizedBook): string {
    return book.summary.primaryAuthor ?? book.summary.authors[0] ?? 'Unknown author';
  }
  /**
   * Displays the normalized publication date or the unknown-year fallback.
   */
  protected publishedDate(book: NormalizedBook): string {
    return book.summary.publishedDate ?? 'Unknown year';
  }
  /**
   * Builds a compact metadata line for search results from stable computed summary fields.
   */
  protected resultMetadata(book: NormalizedBook): string {
    const summary = book.summary;
    const values = [
      this.publishedDate(book),
      summary.publisher,
      typeof summary.pageCount === 'number' ? `${summary.pageCount} pages` : null,
      summary.isbn13 ?? summary.isbn10,
    ].filter((value): value is string => Boolean(value));

    return values.join(' | ');
  }
  /**
   * Shows only the first few genres so result rows stay scannable.
   */
  protected previewGenres(book: NormalizedBook): string[] {
    return book.summary.genres.slice(0, 3);
  }
  /**
   * Returns whether a Google result has the ISBN identity required for library saves.
   */
  protected canSaveBook(book: NormalizedBook): boolean {
    return Boolean(book.summary.isbn13 || book.summary.isbn10);
  }
  /**
   * Returns the stable per-result UI key used for pending states and template tracking.
   */
  protected bookKey(book: NormalizedBook): string {
    return book.summary.providerKey;
  }
  /**
   * Calls the backend search endpoint and stores the result, echoed filters, and dynamic facets.
   *
   * The backend may normalize filters differently from the request, so the
   * response is treated as authoritative for active chip state and year inputs.
   */
  private async searchCurrentQuery(
    query: string,
    page: number,
    filters: BookSearchRequestFilters,
  ): Promise<void> {
    this.error.set(null);
    this.status.set(null);
    this.isSearching.set(true);

    try {
      const response = await this.books.search(query, page, this.pageSize, filters);
      this.results.set(response.items);
      this.total.set(response.total);
      this.currentPage.set(response.page);
      this.activeFilters.set(response.filters);
      this.facets.set(response.facets);
    } catch {
      this.error.set('Search failed.');
      this.results.set([]);
      this.facets.set(emptyFacets);
      this.total.set(0);
    } finally {
      this.isSearching.set(false);
    }
  }
  /**
   * Writes search state to query params.
   *
   * `null` deliberately removes inactive filter/page params during Angular's
   * merge navigation so stale filters do not survive a clear or toggle.
   */
  private async navigateToSearch(
    query: string,
    page: number,
    filters: BookSearchRequestFilters = this.filtersFromCurrentState(),
  ): Promise<void> {
    await this.router.navigate([], {
      queryParams: {
        filter: filters.filter ?? null,
        orderBy: filters.orderBy && filters.orderBy !== 'relevance' ? filters.orderBy : null,
        page: page <= 1 ? null : page,
        printType:
          filters.printType && filters.printType !== 'books' ? filters.printType : null,
        query,
        format: null,
        subject: null,
        yearFrom: null,
        yearTo: null,
      },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }
  /**
   * Merges a facet toggle into current filters and restarts at page one.
   */
  private async navigateWithFilterPatch(patch: BookSearchRequestFilters): Promise<void> {
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, 1, {
      ...this.filtersFromCurrentState(),
      ...patch,
    });
  }
  /**
   * Builds an API request filter object from active chips plus editable year fields.
   */
  private filtersFromCurrentState(): BookSearchRequestFilters {
    const activeFilters = this.activeFilters();

    return {
      ...(activeFilters.filter ? { filter: activeFilters.filter } : {}),
      ...(activeFilters.orderBy !== 'relevance' ? { orderBy: activeFilters.orderBy } : {}),
      ...(activeFilters.printType !== 'books' ? { printType: activeFilters.printType } : {}),
    };
  }
  /**
   * Hydrates URL filter params into the backend request shape.
   */
  private filtersFromParams(params: ParamMap): BookSearchRequestFilters {
    const filter = params.get('filter');
    const orderBy = params.get('orderBy');
    const printType = params.get('printType');

    return {
      ...(isGoogleFilter(filter) ? { filter } : {}),
      ...(orderBy === 'newest' || orderBy === 'relevance' ? { orderBy } : {}),
      ...(printType === 'all' || printType === 'books' || printType === 'magazines'
        ? { printType }
        : {}),
    };
  }
  /**
   * Converts request filters into the nullable response shape used before the backend responds.
   */
  private responseFiltersFromRequest(filters: BookSearchRequestFilters): BookSearchFilters {
    return {
      filter: filters.filter ?? null,
      orderBy: filters.orderBy ?? 'relevance',
      printType: filters.printType ?? 'books',
    };
  }
  /**
   * Normalizes page so comparisons, persistence, and API responses stay stable.
   */
  private normalizePage(value: string | null): number {
    const page = Number(value);

    return Number.isInteger(page) && page > 0 ? page : 1;
  }
  /**
   * Loads active shelves for the add-to-library picker.
   */
  private async loadShelves(): Promise<void> {
    this.isLoadingShelves.set(true);

    try {
      this.shelves.set(await this.shelvesService.list());
      this.ensureSelectedShelf();
    } catch {
      this.error.set('Shelves could not be loaded.');
    } finally {
      this.isLoadingShelves.set(false);
    }
  }
  /**
   * Keeps the shelf picker on a real shelf after shelves reload or query-prefilled shelf ids change.
   */
  private ensureSelectedShelf(): void {
    const shelves = this.shelves();
    const currentShelfId = this.shelfPickerModel().shelfId;
    const preferredShelfId = this.route.snapshot.queryParamMap.get('shelfId') ?? '';

    if (shelves.some((shelf) => shelf.id === currentShelfId)) {
      return;
    }

    const preferredShelf = shelves.find((shelf) => shelf.id === preferredShelfId);
    this.shelfPickerModel.set({ shelfId: preferredShelf?.id ?? shelves[0]?.id ?? '' });
  }
}

/**
 * Extracts the Google Books volume id from the normalized provider key when the explicit field is
 * missing in older generated API types.
 */
function googleVolumeIdFromProviderKey(providerKey: string): string | null {
  return providerKey.startsWith('google:') ? providerKey.slice('google:'.length) : null;
}

/**
 * Narrows URL params to the Google Books availability values the backend accepts.
 */
function isGoogleFilter(value: string | null): value is NonNullable<BookSearchRequestFilters['filter']> {
  return value === 'ebooks' || value === 'free-ebooks' || value === 'full' || value === 'paid-ebooks';
}
