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
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
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
  protected readonly canGoNext = computed(() => this.currentPage() < this.totalPages() && !this.isSearching());
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
      facets.publishedDecades.length > 0 ||
      facets.subjects.length > 0 ||
      facets.formats.length > 0
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

  protected async submitSearch(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.status.set(null);

    const successful = await submit(this.searchForm, async (formTree) => {
      await this.navigateToSearch(formTree().value().query.trim(), 1, this.filtersFromCurrentState());
    });

    if (!successful) {
      this.error.set('Search failed.');
    }
  }

  protected async goToPage(page: number): Promise<void> {
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, page);
  }

  protected async submitFilters(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, 1, this.filtersFromCurrentState());
  }

  protected async applyDecadeFilter(facet: BookSearchDecadeFacet): Promise<void> {
    const current = this.activeFilters();
    const isActive = current.yearFrom === facet.yearFrom && current.yearTo === facet.yearTo;

    await this.navigateWithFilterPatch({
      yearFrom: isActive ? undefined : facet.yearFrom,
      yearTo: isActive ? undefined : facet.yearTo,
    });
  }

  protected async applySubjectFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      subject: this.activeFilters().subject === facet.value ? undefined : facet.value,
    });
  }

  protected async applyFormatFilter(facet: BookSearchValueFacet): Promise<void> {
    await this.navigateWithFilterPatch({
      format: this.activeFilters().format === facet.value ? undefined : 'ebook',
    });
  }

  protected async clearFilters(): Promise<void> {
    const query = this.model().query.trim();

    if (!query || this.isSearching()) {
      return;
    }

    await this.navigateToSearch(query, 1, {});
  }

  protected isDecadeActive(facet: BookSearchDecadeFacet): boolean {
    const filters = this.activeFilters();

    return filters.yearFrom === facet.yearFrom && filters.yearTo === facet.yearTo;
  }

  protected isSubjectActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().subject === facet.value;
  }

  protected isFormatActive(facet: BookSearchValueFacet): boolean {
    return this.activeFilters().format === facet.value;
  }

  protected openAddBookDialog(book: NormalizedBook): void {
    this.error.set(null);
    this.status.set(null);
    this.selectedBook.set(book);
    this.ensureSelectedShelf();
    this.addBookDialog()?.nativeElement.showModal();
  }

  protected closeAddBookDialog(): void {
    this.addBookDialog()?.nativeElement.close();
    this.selectedBook.set(null);
  }

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

  protected coverUrl(book: NormalizedBook): string | null {
    return typeof book.coverUrl === 'string' ? book.coverUrl : null;
  }

  protected primaryAuthor(book: NormalizedBook): string {
    return typeof book.primaryAuthor === 'string' ? book.primaryAuthor : book.authors[0] ?? 'Unknown author';
  }

  protected publishedDate(book: NormalizedBook): string {
    return typeof book.publishedDate === 'string' ? book.publishedDate : 'Unknown year';
  }

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

  private applyFilterModel(filters: BookSearchFilters | BookSearchRequestFilters): void {
    this.filterModel.set({
      yearFrom: typeof filters.yearFrom === 'number' ? String(filters.yearFrom) : '',
      yearTo: typeof filters.yearTo === 'number' ? String(filters.yearTo) : '',
    });
  }

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

  private filtersFromParams(params: ParamMap): BookSearchRequestFilters {
    const subject = params.get('subject')?.trim();
    const format = params.get('format');

    return {
      ...(format === 'ebook' ? { format } : {}),
      ...(subject ? { subject } : {}),
      ...this.yearFiltersFromParams(params),
    };
  }

  private responseFiltersFromRequest(filters: BookSearchRequestFilters): BookSearchFilters {
    return {
      format: filters.format ?? null,
      subject: filters.subject ?? null,
      yearFrom: filters.yearFrom ?? null,
      yearTo: filters.yearTo ?? null,
    };
  }

  private normalizePage(value: string | null): number {
    const page = Number(value);

    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  private normalizeOptionalYear(value: null | string): number | undefined {
    if (!value) {
      return undefined;
    }

    const year = Number(value);

    return Number.isInteger(year) && year >= 0 ? year : undefined;
  }

  private yearFiltersFromParams(params: ParamMap): BookSearchRequestFilters {
    const yearFrom = this.normalizeOptionalYear(params.get('yearFrom'));
    const yearTo = this.normalizeOptionalYear(params.get('yearTo'));

    return {
      ...(typeof yearFrom === 'number' ? { yearFrom } : {}),
      ...(typeof yearTo === 'number' ? { yearTo } : {}),
    };
  }

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
