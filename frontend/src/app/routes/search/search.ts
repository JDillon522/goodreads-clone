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
  BookSearchDecadeFacet,
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
 * Search route controller for Open Library discovery.
 *
 * The URL is the source of truth for query text, page, and filters so browser
 * refresh, pagination, author links, and shared URLs all rehydrate the same
 * server-backed search state.
 */
const emptyFacets: BookSearchFacets = {
  formats: [],
  publishedDecades: [],
  subjects: [],
};
const emptyFilters: BookSearchFilters = {
  format: null,
  subject: null,
  yearFrom: null,
  yearTo: null,
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
  private readonly filterModel = signal({ yearFrom: '', yearTo: '' });
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
      filters.format ||
      filters.subject ||
      typeof filters.yearFrom === 'number' ||
      typeof filters.yearTo === 'number',
    );
  });
  protected readonly hasFilterOptions = computed(() => {
    const facets = this.facets();

    return (
      facets.publishedDecades.length > 0 || facets.subjects.length > 0 || facets.formats.length > 0
    );
  });
  protected readonly searchForm = form(this.model, (path) => {
    required(path.query, { message: 'Search terms are required.' });
    minLength(path.query, 2, { message: 'Use at least 2 characters.' });
  });
  protected readonly filtersForm = form(this.filterModel, () => {});
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
        this.filterModel.set({ yearFrom: '', yearTo: '' });
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
      // effects and form writes from causing duplicate Open Library calls.
      const searchKey = JSON.stringify({ filters, page, query });

      if (searchKey === this.lastQueryParamSearch) {
        return;
      }

      this.lastQueryParamSearch = searchKey;
      this.model.set({ query });
      this.applyFilterModel(filters);
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
   * Applies typed year filters and resets pagination because the result set changes.
   */
  protected async submitFilters(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, 1, this.filtersFromCurrentState());
  }
  /**
   * Toggles a decade facet by replacing the manual year range with the facet bounds.
   */
  protected async applyDecadeFilter(facet: BookSearchDecadeFacet): Promise<void> {
    const current = this.activeFilters();
    const isActive = current.yearFrom === facet.yearFrom && current.yearTo === facet.yearTo;

    await this.navigateWithFilterPatch({
      yearFrom: isActive ? undefined : facet.yearFrom,
      yearTo: isActive ? undefined : facet.yearTo,
    });
  }
  /**
   * Toggles the single selected subject facet supported by the v1 search API.
   */
  protected async applySubjectFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      subject: this.activeFilters().subject === facet.value ? undefined : facet.value,
    });
  }
  /**
   * Toggles the readable-online filter; v1 only exposes the eBook/readable option.
   */
  protected async applyFormatFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      format: this.activeFilters().format === facet.value ? undefined : 'ebook',
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
   * Checks active decade state after either a facet click or manual year entry.
   */
  protected isDecadeActive(facet: BookSearchDecadeFacet): boolean {
    const filters = this.activeFilters();

    return filters.yearFrom === facet.yearFrom && filters.yearTo === facet.yearTo;
  }
  /**
   * Marks the subject chip active when the URL/backend filter matches the facet value.
   */
  protected isSubjectActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().subject === facet.value;
  }
  /**
   * Marks the readable-online chip active when the backend echoed that filter.
   */
  protected isFormatActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().format === facet.value;
  }
  /**
   * Opens the add dialog with a valid shelf selection before the user submits.
   */
  protected openAddBookDialog(book: NormalizedBook): void {
    this.error.set(null);
    this.status.set(null);
    this.selectedBook.set(book);
    this.ensureSelectedShelf();
    this.addBookDialog()?.nativeElement.showModal();
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
    this.addingKey.set(book.providerKey);

    try {
      const successful = await submit(this.shelfPickerForm, async (formTree) => {
        await this.library.add({ book, shelfId: formTree().value().shelfId });
        this.status.set(`${book.title} was added to your library.`);
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
   * Returns a usable cover URL only when Open Library provided one.
   */
  protected coverUrl(book: NormalizedBook): string | null {
    return typeof book.coverUrl === 'string' ? book.coverUrl : null;
  }
  /**
   * Chooses the normalized primary author, falling back to the first author label.
   */
  protected primaryAuthor(book: NormalizedBook): string {
    return typeof book.primaryAuthor === 'string'
      ? book.primaryAuthor
      : (book.authors[0] ?? 'Unknown author');
  }
  /**
   * Displays the normalized publication date or the unknown-year fallback.
   */
  protected publishedDate(book: NormalizedBook): string {
    return typeof book.publishedDate === 'string' ? book.publishedDate : 'Unknown year';
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
      this.applyFilterModel(response.filters);
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
        format: filters.format ?? null,
        page: page <= 1 ? null : page,
        query,
        subject: filters.subject ?? null,
        yearFrom: filters.yearFrom ?? null,
        yearTo: filters.yearTo ?? null,
      },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }
  /**
   * Mirrors backend-normalized year filters into the editable year fields.
   */
  private applyFilterModel(filters: BookSearchFilters | BookSearchRequestFilters): void {
    this.filterModel.set({
      yearFrom: typeof filters.yearFrom === 'number' ? String(filters.yearFrom) : '',
      yearTo: typeof filters.yearTo === 'number' ? String(filters.yearTo) : '',
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
    const yearFrom = this.normalizeOptionalYear(this.filterModel().yearFrom);
    const yearTo = this.normalizeOptionalYear(this.filterModel().yearTo);

    return {
      ...(activeFilters.format ? { format: activeFilters.format } : {}),
      ...(activeFilters.subject ? { subject: activeFilters.subject } : {}),
      ...(typeof yearFrom === 'number' ? { yearFrom } : {}),
      ...(typeof yearTo === 'number' ? { yearTo } : {}),
    };
  }
  /**
   * Hydrates URL filter params into the backend request shape.
   */
  private filtersFromParams(params: ParamMap): BookSearchRequestFilters {
    const subject = params.get('subject')?.trim();
    const format = params.get('format');

    return {
      ...(format === 'ebook' ? { format } : {}),
      ...(subject ? { subject } : {}),
      ...this.yearFiltersFromParams(params),
    };
  }
  /**
   * Converts request filters into the nullable response shape used before the backend responds.
   */
  private responseFiltersFromRequest(filters: BookSearchRequestFilters): BookSearchFilters {
    return {
      format: filters.format ?? null,
      subject: filters.subject ?? null,
      yearFrom: filters.yearFrom ?? null,
      yearTo: filters.yearTo ?? null,
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
   * Normalizes optional year so comparisons, persistence, and API responses stay stable.
   */
  private normalizeOptionalYear(value: null | string): number | undefined {
    if (!value) {
      return undefined;
    }

    const year = Number(value);

    return Number.isInteger(year) && year >= 0 ? year : undefined;
  }
  /**
   * Parses optional year params and drops invalid values instead of sending them to the API.
   */
  private yearFiltersFromParams(params: ParamMap): BookSearchRequestFilters {
    const yearFrom = this.normalizeOptionalYear(params.get('yearFrom'));
    const yearTo = this.normalizeOptionalYear(params.get('yearTo'));

    return {
      ...(typeof yearFrom === 'number' ? { yearFrom } : {}),
      ...(typeof yearTo === 'number' ? { yearTo } : {}),
    };
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
