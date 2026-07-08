import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import type { DeletedShelfBookResponse, DeleteShelfResponse, LibraryItemResponse, ShelfResponse } from '../../core/api/api.types';
import { Auth } from '../../core/auth/auth';
import { Library as LibraryService } from '../../core/library/library';
import { SessionStore } from '../../core/session/session-store';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';

@Component({
  selector: 'app-app-shell',
  imports: [DatePipe, FormField, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(Auth);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);
  private readonly renameShelfDialog = viewChild<ElementRef<HTMLDialogElement>>('renameShelfDialog');
  private readonly deleteShelfDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteShelfDialog');
  private readonly createShelfModel = signal({ name: '' });
  private readonly renameShelfModel = signal({ name: '' });

  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(Theme);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly isLoadingShelves = signal(true);
  protected readonly shelfMessage = signal<string | null>(null);
  protected readonly shelfError = signal<string | null>(null);
  protected readonly selectedRenameShelf = signal<ShelfResponse | null>(null);
  protected readonly selectedDeleteShelf = signal<ShelfResponse | null>(null);
  protected readonly deletePreviewItems = signal<LibraryItemResponse[]>([]);
  protected readonly deleteResult = signal<DeleteShelfResponse | null>(null);
  protected readonly isLoadingDeletePreview = signal(false);
  protected readonly isDeletingShelf = signal(false);
  protected readonly createShelfForm = form(this.createShelfModel, (path) => {
    required(path.name, { message: 'Shelf name is required.' });
    minLength(path.name, 2, { message: 'Use at least 2 characters.' });
  });
  protected readonly renameShelfForm = form(this.renameShelfModel, (path) => {
    required(path.name, { message: 'Shelf name is required.' });
    minLength(path.name, 2, { message: 'Use at least 2 characters.' });
  });

  public constructor() {
    effect(() => {
      this.shelvesService.version();
      this.library.version();
      void this.loadShelves();
    });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }

  protected async submitCreateShelf(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.shelfMessage.set(null);
    this.shelfError.set(null);

    try {
      const successful = await submit(this.createShelfForm, async (formTree) => {
        const name = formTree().value().name.trim();
        await this.shelvesService.create({ name });
        this.createShelfModel.set({ name: '' });
        this.shelfMessage.set(`${name} shelf created.`);
      });

      if (!successful) {
        this.shelfError.set('Shelf could not be created.');
      }
    } catch {
      this.shelfError.set('Shelf could not be created.');
    }
  }

  protected openRenameShelfDialog(shelf: ShelfResponse): void {
    this.selectedRenameShelf.set(shelf);
    this.renameShelfModel.set({ name: shelf.name });
    this.shelfMessage.set(null);
    this.shelfError.set(null);
    this.renameShelfDialog()?.nativeElement.showModal();
  }

  protected closeRenameShelfDialog(): void {
    this.renameShelfDialog()?.nativeElement.close();
    this.selectedRenameShelf.set(null);
  }

  protected async submitRenameShelf(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const shelf = this.selectedRenameShelf();

    if (!shelf) {
      return;
    }

    this.shelfMessage.set(null);
    this.shelfError.set(null);

    try {
      const successful = await submit(this.renameShelfForm, async (formTree) => {
        const name = formTree().value().name.trim();
        await this.shelvesService.update(shelf.id, { name });
        this.shelfMessage.set(`${name} shelf renamed.`);
        this.closeRenameShelfDialog();
      });

      if (!successful) {
        this.shelfError.set('Shelf could not be renamed.');
      }
    } catch {
      this.shelfError.set('Shelf could not be renamed.');
    }
  }

  protected canDeleteShelf(shelf: ShelfResponse): boolean {
    return shelf.slug !== 'unshelved';
  }

  protected async openDeleteShelfDialog(shelf: ShelfResponse): Promise<void> {
    if (!this.canDeleteShelf(shelf)) {
      return;
    }

    this.selectedDeleteShelf.set(shelf);
    this.deletePreviewItems.set([]);
    this.deleteResult.set(null);
    this.shelfMessage.set(null);
    this.shelfError.set(null);
    this.isLoadingDeletePreview.set(true);
    this.deleteShelfDialog()?.nativeElement.showModal();

    try {
      this.deletePreviewItems.set(await this.library.list(shelf.id));
    } catch {
      this.shelfError.set('Books on this shelf could not be previewed.');
    } finally {
      this.isLoadingDeletePreview.set(false);
    }
  }

  protected closeDeleteShelfDialog(): void {
    this.deleteShelfDialog()?.nativeElement.close();
    this.selectedDeleteShelf.set(null);
    this.deletePreviewItems.set([]);
    this.deleteResult.set(null);
    this.isLoadingDeletePreview.set(false);
  }

  protected async confirmDeleteShelf(): Promise<void> {
    const shelf = this.selectedDeleteShelf();

    if (!shelf) {
      return;
    }

    this.shelfError.set(null);
    this.isDeletingShelf.set(true);

    try {
      const result = await this.shelvesService.delete(shelf.id);
      this.deleteResult.set(result);
      this.shelfMessage.set(`${result.deletedShelfName} shelf deleted.`);

      if (this.router.url.startsWith(`/app/shelves/${shelf.id}`)) {
        await this.router.navigate(['/app/library']);
      }
    } catch {
      this.shelfError.set('Shelf could not be deleted.');
    } finally {
      this.isDeletingShelf.set(false);
    }
  }

  protected shelfNames(item: LibraryItemResponse): string {
    return item.shelves.map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }

  protected resultShelfNames(book: DeletedShelfBookResponse): string {
    return book.shelves.map((shelf) => shelf.name).join(', ') || 'Unshelved';
  }

  private async loadShelves(): Promise<void> {
    this.isLoadingShelves.set(true);

    try {
      this.shelves.set(await this.shelvesService.list());
    } catch {
      this.shelfError.set('Shelves could not be loaded.');
    } finally {
      this.isLoadingShelves.set(false);
    }
  }
}
