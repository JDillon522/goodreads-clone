import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { form } from '@angular/forms/signals';

import type {
  BookSummary,
  BookshelfCandidate,
  BookshelfDetectionResponse,
  BookshelfPhotoDetail,
  BookshelfPhotoSummary,
  BookshelfScanDetection,
  LibraryItemResponse,
  ShelfResponse,
} from '../../core/api/api.types';
import { Bookshelves, type SaveBookshelfDetection } from '../../core/bookshelves/bookshelves';
import { Library } from '../../core/library/library';
import { Shelves } from '../../core/shelves/shelves';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

type ScanStep = 'ANALYZING' | 'REVIEW' | 'UPLOAD';
type Resolution = { libraryItemId: string; message: string };
type PhotoCard = BookshelfPhotoSummary & { thumbnailUrl: string };
type SearchContext =
  { detectionId: string; kind: 'SAVED'; photoId: string } | { detectionId: string; kind: 'SCAN' };

const maxImageBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const analysisStages = [
  'Uploading the photograph securely...',
  'Gemini is locating visible book spines...',
  'Reading titles, authors, and ISBN clues...',
  'Checking likely editions against Google Books...',
] as const;

/** Saved shelf gallery and synchronous AI-assisted review workflow. */
@Component({
  selector: 'app-bookshelves-page',
  imports: [NgTemplateOutlet, UiFormControl],
  templateUrl: './bookshelves.html',
  styleUrl: './bookshelves.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookshelvesPage {
  private readonly bookshelves = inject(Bookshelves);
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(Library);
  private readonly shelvesService = inject(Shelves);
  private readonly scanDialog = viewChild<ElementRef<HTMLDialogElement>>('scanDialog');
  private readonly detailDialog = viewChild<ElementRef<HTMLDialogElement>>('detailDialog');
  private readonly objectUrls = new Set<string>();
  private analysisTimer: ReturnType<typeof setInterval> | null = null;
  protected readonly formModel = signal({
    detailLabel: '',
    label: '',
    searchQuery: '',
    shelfId: '',
  });

  protected readonly scanForm = form(this.formModel);
  protected readonly photos = signal<PhotoCard[]>([]);
  protected readonly isLoadingPhotos = signal(true);
  protected readonly pageError = signal<string | null>(null);
  protected readonly pageStatus = signal<string | null>(null);
  protected readonly step = signal<ScanStep>('UPLOAD');
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected readonly analysis = signal<BookshelfScanDetection[]>([]);
  protected readonly model = signal('');
  protected readonly analysisStatus = signal<string>(analysisStages[0]);
  protected readonly analysisElapsedSeconds = signal(0);
  protected readonly activeDetectionId = signal<string | null>(null);
  protected readonly selectedCandidates = signal<Record<string, BookshelfCandidate | null>>({});
  protected readonly includedNewBooks = signal<Record<string, boolean>>({});
  protected readonly resolutions = signal<Record<string, Resolution>>({});
  protected readonly applyingBooks = signal(false);
  protected readonly savingPhoto = signal(false);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly searchContext = signal<SearchContext | null>(null);
  protected readonly searchResults = signal<BookshelfCandidate[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly selectedPhoto = signal<BookshelfPhotoDetail | null>(null);
  protected readonly selectedPhotoUrl = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly detailStatus = signal<string | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly selectedSavedDetectionId = signal<string | null>(null);

  protected readonly newBookCount = computed(
    () =>
      this.analysis().filter(
        (detection) => this.selectedCandidate(detection)?.classification === 'NEW',
      ).length,
  );
  protected readonly unresolvedCount = computed(
    () => this.analysis().filter((detection) => !this.selectedCandidate(detection)).length,
  );

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopAnalysisProgress();
      this.revokeAllObjectUrls();
    });
    void this.loadPhotos();
  }

  protected async openScan(): Promise<void> {
    this.resetScan();
    this.scanDialog()?.nativeElement.showModal();

    try {
      const shelves = await this.shelvesService.list();
      this.shelves.set(shelves);
      this.formModel.update((value) => ({
        ...value,
        shelfId: shelves.find((shelf) => shelf.isDefault)?.id ?? shelves[0]?.id ?? '',
      }));
    } catch {
      this.scanError.set('Shelves could not be loaded. You can still review and save the photo.');
    }
  }

  protected closeScan(): void {
    this.scanDialog()?.nativeElement.close();
    this.resetScan();
  }

  protected chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.scanError.set(null);

    if (!file) {
      return;
    }

    if (!acceptedImageTypes.has(file.type)) {
      this.scanError.set('Upload a JPEG, PNG, or WebP image. HEIC and HEIF are not supported yet.');
      input.value = '';
      return;
    }

    if (file.size > maxImageBytes) {
      this.scanError.set('The image must be 10 MiB or smaller.');
      input.value = '';
      return;
    }

    this.revokeUrl(this.previewUrl());
    const url = this.createObjectUrl(file);
    this.selectedFile.set(file);
    this.previewUrl.set(url);
    this.formModel.update((value) => ({
      ...value,
      label: value.label || file.name.replace(/\.[^.]+$/, '').slice(0, 120),
    }));
  }

  protected async analyze(): Promise<void> {
    const file = this.selectedFile();

    if (!file) {
      this.scanError.set('Choose a bookshelf image first.');
      return;
    }

    this.scanError.set(null);
    this.step.set('ANALYZING');
    this.startAnalysisProgress();

    try {
      const result = await this.bookshelves.analyze(file);
      this.analysis.set(result.detections);
      this.model.set(result.model);
      this.activeDetectionId.set(result.detections[0]?.id ?? null);
      this.selectedCandidates.set(
        Object.fromEntries(
          result.detections.map((detection) => [detection.id, detection.candidates[0] ?? null]),
        ),
      );
      this.includedNewBooks.set(
        Object.fromEntries(
          result.detections.map((detection) => [
            detection.id,
            detection.candidates[0]?.classification === 'NEW',
          ]),
        ),
      );
      this.step.set('REVIEW');
    } catch {
      this.scanError.set('The bookshelf could not be analyzed. Check the image and try again.');
      this.step.set('UPLOAD');
    } finally {
      this.stopAnalysisProgress();
    }
  }

  protected selectedCandidate(detection: BookshelfScanDetection): BookshelfCandidate | null {
    return this.selectedCandidates()[detection.id] ?? null;
  }

  protected selectCandidate(
    detection: BookshelfScanDetection,
    candidate: BookshelfCandidate,
  ): void {
    this.selectedCandidates.update((value) => ({ ...value, [detection.id]: candidate }));
    this.includedNewBooks.update((value) => ({
      ...value,
      [detection.id]: candidate.classification === 'NEW',
    }));
    this.resolutions.update((value) => {
      const next = { ...value };
      delete next[detection.id];
      return next;
    });
  }

  protected candidateSelected(
    detection: BookshelfScanDetection,
    candidate: BookshelfCandidate,
  ): boolean {
    return this.selectedCandidate(detection)?.book.id === candidate.book.id;
  }

  protected toggleNewBook(detectionId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.includedNewBooks.update((value) => ({ ...value, [detectionId]: checked }));
  }

  protected focusDetection(detectionId: string): void {
    this.activeDetectionId.set(detectionId);
  }

  protected resolution(detectionId: string): Resolution | null {
    return this.resolutions()[detectionId] ?? null;
  }

  protected async addSelectedBooks(): Promise<void> {
    const shelfId = this.formModel().shelfId;

    if (!shelfId) {
      this.scanError.set('Choose a shelf before adding detected books.');
      return;
    }

    this.applyingBooks.set(true);
    this.scanError.set(null);

    for (const detection of this.analysis()) {
      const candidate = this.selectedCandidate(detection);

      if (
        !candidate ||
        candidate.classification !== 'NEW' ||
        !this.includedNewBooks()[detection.id] ||
        this.resolution(detection.id)
      ) {
        continue;
      }

      try {
        const item = await this.library.add({
          googleBooksVolumeId: candidate.book.summary.googleBooksVolumeId,
          isbn10: candidate.book.summary.isbn10,
          isbn13: candidate.book.summary.isbn13,
          shelfId,
        });
        this.setResolution(detection.id, item.id, `Added to ${this.shelfName(shelfId)}.`);
      } catch {
        this.scanError.set(
          'Some detected books could not be added. Successful additions were kept.',
        );
      }
    }

    this.applyingBooks.set(false);
  }

  protected async useLibraryEdition(
    detection: BookshelfScanDetection,
    item: LibraryItemResponse,
    replace: boolean,
  ): Promise<void> {
    const candidate = this.selectedCandidate(detection);
    const volumeId = candidate?.book.summary.googleBooksVolumeId;

    if (!candidate || !volumeId) {
      return;
    }

    try {
      if (replace) {
        await this.library.replaceEdition(item.id, { googleBooksVolumeId: volumeId });
      }
      this.setResolution(
        detection.id,
        item.id,
        replace
          ? 'Edition replaced and location associated.'
          : 'Current edition kept; location associated.',
      );
    } catch {
      this.scanError.set('That library edition could not be updated.');
    }
  }

  protected openSearchForScan(detectionId: string): void {
    this.searchContext.set({ detectionId, kind: 'SCAN' });
    this.searchResults.set([]);
    this.searchError.set(null);
    this.formModel.update((value) => ({ ...value, searchQuery: '' }));
  }

  protected openSearchForSaved(detectionId: string): void {
    const photo = this.selectedPhoto();
    if (!photo) return;
    this.selectedSavedDetectionId.set(detectionId);
    this.searchContext.set({ detectionId, kind: 'SAVED', photoId: photo.id });
    this.searchResults.set([]);
    this.searchError.set(null);
    this.formModel.update((value) => ({ ...value, searchQuery: '' }));
  }

  protected async searchBooks(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const query = this.formModel().searchQuery.trim();

    if (query.length < 2) {
      this.searchError.set('Enter at least two characters.');
      return;
    }

    this.searching.set(true);
    this.searchError.set(null);

    try {
      this.searchResults.set((await this.bookshelves.search(query)).items);
    } catch {
      this.searchError.set('Google Books search is unavailable.');
    } finally {
      this.searching.set(false);
    }
  }

  protected chooseSearchCandidate(candidate: BookshelfCandidate): void {
    const context = this.searchContext();
    if (!context || context.kind !== 'SCAN') return;
    const detection = this.analysis().find((item) => item.id === context.detectionId);
    if (detection) this.selectCandidate(detection, candidate);
    this.searchContext.set(null);
  }

  protected async savePhoto(): Promise<void> {
    const image = this.selectedFile();
    if (!image) return;

    this.savingPhoto.set(true);
    this.scanError.set(null);

    try {
      const detections = this.analysis().map((detection): SaveBookshelfDetection => {
        const candidate = this.selectedCandidate(detection);
        const exactLibraryId =
          candidate?.classification === 'EXACT_EDITION'
            ? (candidate.libraryMatches[0]?.id ?? null)
            : null;
        return {
          boundingBox: detection.boundingBox,
          confidence: detection.confidence,
          libraryItemId: this.resolution(detection.id)?.libraryItemId ?? exactLibraryId,
          observedAuthors: detection.observedAuthors,
          observedIsbn10: detection.observedIsbn10,
          observedIsbn13: detection.observedIsbn13,
          observedPublisher: detection.observedPublisher,
          observedSpineText: detection.observedSpineText,
          observedTitle: detection.observedTitle,
          position: detection.position,
          selectedGoogleBooksVolumeId: candidate?.book.summary.googleBooksVolumeId ?? null,
        };
      });
      await this.bookshelves.save(image, this.formModel().label.trim(), detections);
      this.pageStatus.set('Bookshelf photo saved.');
      await this.loadPhotos();
      this.closeScan();
    } catch {
      this.scanError.set('The reviewed bookshelf photo could not be saved.');
    } finally {
      this.savingPhoto.set(false);
    }
  }

  protected async openPhoto(photo: PhotoCard): Promise<void> {
    this.loadingDetail.set(true);
    this.detailError.set(null);
    this.detailStatus.set(null);
    this.detailDialog()?.nativeElement.showModal();

    try {
      const [detail, image] = await Promise.all([
        this.bookshelves.get(photo.id),
        this.bookshelves.image(photo.id),
      ]);
      this.revokeUrl(this.selectedPhotoUrl());
      this.selectedPhoto.set(detail);
      this.selectedPhotoUrl.set(this.createObjectUrl(image));
      this.formModel.update((value) => ({ ...value, detailLabel: detail.label }));
    } catch {
      this.detailError.set('The saved bookshelf photo could not be opened.');
    } finally {
      this.loadingDetail.set(false);
    }
  }

  protected closePhoto(): void {
    this.detailDialog()?.nativeElement.close();
    this.revokeUrl(this.selectedPhotoUrl());
    this.selectedPhotoUrl.set(null);
    this.selectedPhoto.set(null);
    this.searchContext.set(null);
  }

  protected async renamePhoto(): Promise<void> {
    const photo = this.selectedPhoto();
    const label = this.formModel().detailLabel.trim();
    if (!photo || !label) return;

    try {
      const updated = await this.bookshelves.rename(photo.id, label);
      this.selectedPhoto.set(updated);
      this.detailStatus.set('Photo renamed.');
      await this.loadPhotos();
    } catch {
      this.detailError.set('The bookshelf photo could not be renamed.');
    }
  }

  protected async deletePhoto(): Promise<void> {
    const photo = this.selectedPhoto();
    if (!photo || !globalThis.confirm(`Delete “${photo.label}” and its location records?`)) return;

    try {
      await this.bookshelves.delete(photo.id);
      this.closePhoto();
      this.pageStatus.set('Bookshelf photo deleted.');
      await this.loadPhotos();
    } catch {
      this.detailError.set('The bookshelf photo could not be deleted.');
    }
  }

  protected async associateSavedCandidate(
    candidate: BookshelfCandidate,
    item: LibraryItemResponse | null,
    replace: boolean,
  ): Promise<void> {
    const context = this.searchContext();
    const photo = this.selectedPhoto();
    const volumeId = candidate.book.summary.googleBooksVolumeId;
    if (!context || context.kind !== 'SAVED' || !photo || !volumeId) return;

    try {
      let libraryItem = item;

      if (!libraryItem && candidate.classification === 'NEW') {
        libraryItem = await this.library.add({
          googleBooksVolumeId: volumeId,
          isbn10: candidate.book.summary.isbn10,
          isbn13: candidate.book.summary.isbn13,
          shelfId: this.formModel().shelfId || undefined,
        });
      } else if (libraryItem && replace) {
        libraryItem = await this.library.replaceEdition(libraryItem.id, {
          googleBooksVolumeId: volumeId,
        });
      }

      const updated = await this.bookshelves.associate(photo.id, context.detectionId, {
        googleBooksVolumeId: volumeId,
        libraryItemId: libraryItem?.id ?? null,
      });
      this.replaceSavedDetection(updated);
      this.detailStatus.set('Book location associated.');
      this.searchContext.set(null);
    } catch {
      this.detailError.set('That book could not be associated with this shelf location.');
    }
  }

  protected cover(summary: BookSummary | undefined): string | null {
    return summary?.coverImages.card ?? summary?.coverUrl ?? null;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  }

  protected shelfName(id: string): string {
    return this.shelves().find((shelf) => shelf.id === id)?.name ?? 'selected shelf';
  }

  private setResolution(detectionId: string, libraryItemId: string, message: string): void {
    this.resolutions.update((value) => ({
      ...value,
      [detectionId]: { libraryItemId, message },
    }));
  }

  private replaceSavedDetection(updated: BookshelfDetectionResponse): void {
    this.selectedPhoto.update((photo) =>
      photo
        ? {
            ...photo,
            associatedDetectionCount: photo.detections.some(
              (item) => item.id === updated.id && item.libraryItemId,
            )
              ? photo.associatedDetectionCount
              : photo.associatedDetectionCount + (updated.libraryItemId ? 1 : 0),
            detections: photo.detections.map((item) => (item.id === updated.id ? updated : item)),
          }
        : null,
    );
  }

  private async loadPhotos(): Promise<void> {
    this.isLoadingPhotos.set(true);
    this.pageError.set(null);

    try {
      const summaries = await this.bookshelves.list();
      const cards = await Promise.all(
        summaries.map(async (photo) => ({
          ...photo,
          thumbnailUrl: this.createObjectUrl(await this.bookshelves.image(photo.id, true)),
        })),
      );
      for (const photo of this.photos()) this.revokeUrl(photo.thumbnailUrl);
      this.photos.set(cards);
    } catch {
      this.pageError.set('Saved bookshelf photos could not be loaded.');
    } finally {
      this.isLoadingPhotos.set(false);
    }
  }

  private resetScan(): void {
    this.stopAnalysisProgress();
    this.revokeUrl(this.previewUrl());
    this.previewUrl.set(null);
    this.selectedFile.set(null);
    this.step.set('UPLOAD');
    this.analysis.set([]);
    this.model.set('');
    this.analysisStatus.set(analysisStages[0]);
    this.analysisElapsedSeconds.set(0);
    this.selectedCandidates.set({});
    this.includedNewBooks.set({});
    this.resolutions.set({});
    this.scanError.set(null);
    this.searchContext.set(null);
    this.searchResults.set([]);
    this.formModel.update((value) => ({ ...value, label: '', searchQuery: '' }));
  }

  private createObjectUrl(value: Blob): string {
    const url = URL.createObjectURL(value);
    this.objectUrls.add(url);
    return url;
  }

  private revokeUrl(url: string | null): void {
    if (!url || !this.objectUrls.has(url)) return;
    URL.revokeObjectURL(url);
    this.objectUrls.delete(url);
  }

  private revokeAllObjectUrls(): void {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
  }

  private startAnalysisProgress(): void {
    this.stopAnalysisProgress();
    this.analysisElapsedSeconds.set(0);
    this.analysisStatus.set(analysisStages[0]);
    this.analysisTimer = setInterval(() => {
      const elapsed = this.analysisElapsedSeconds() + 1;
      const stage = elapsed >= 30 ? 3 : elapsed >= 15 ? 2 : elapsed >= 5 ? 1 : 0;
      this.analysisElapsedSeconds.set(elapsed);
      this.analysisStatus.set(analysisStages[stage]);
    }, 1_000);
  }

  private stopAnalysisProgress(): void {
    if (this.analysisTimer === null) return;
    clearInterval(this.analysisTimer);
    this.analysisTimer = null;
  }
}
