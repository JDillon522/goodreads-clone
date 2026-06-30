import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, FormField, max, min, required, submit } from '@angular/forms/signals';

import type { LibraryItemResponse, UpdateProgressRequest } from '../../core/api/api.types';
import { Library as LibraryService } from '../../core/library/library';

@Component({
  selector: 'app-book-detail',
  imports: [FormField, RouterLink],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDetail {
  private readonly destroyRef = inject(DestroyRef);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly progressModel = signal({ trackingMode: 'PAGE' as 'PAGE' | 'PERCENT', currentPage: 0, currentPercent: 0 });

  protected readonly item = signal<LibraryItemResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly progressForm = form(this.progressModel, (path) => {
    required(path.trackingMode);
    min(path.currentPage, 0);
    min(path.currentPercent, 0);
    max(path.currentPercent, 100);
  });

  public constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        void this.loadBook(id);
      }
    });
  }

  protected coverUrl(): string | null {
    const item = this.item();
    return item && typeof item.book.coverUrl === 'string' ? item.book.coverUrl : null;
  }

  protected primaryAuthor(): string {
    const item = this.item();
    return item && typeof item.book.primaryAuthor === 'string' ? item.book.primaryAuthor : item?.book.authors[0] ?? 'Unknown author';
  }

  protected description(): string {
    const item = this.item();
    return item && typeof item.book.description === 'string' ? item.book.description : 'No description is available for this edition.';
  }

  protected async submitProgress(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const item = this.item();
    if (!item) {
      return;
    }

    this.error.set(null);
    this.status.set(null);

    const successful = await submit(this.progressForm, async (formTree) => {
      const value = formTree().value();
      const request: UpdateProgressRequest =
        value.trackingMode === 'PAGE'
          ? { trackingMode: 'PAGE', currentPage: value.currentPage }
          : { trackingMode: 'PERCENT', currentPercent: value.currentPercent };

      const updated = await this.library.updateProgress(item.id, request);
      this.item.set(updated);
      this.status.set('Progress updated.');
    });

    if (!successful) {
      this.error.set('Progress could not be updated.');
    }
  }

  private async loadBook(id: string): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const item = await this.library.get(id);
      this.item.set(item);
      this.progressModel.set({
        trackingMode: typeof item.currentPercent === 'number' ? 'PERCENT' : 'PAGE',
        currentPage: typeof item.currentPage === 'number' ? item.currentPage : 0,
        currentPercent: typeof item.currentPercent === 'number' ? item.currentPercent : 0,
      });
    } catch {
      this.error.set('Book could not be loaded.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
