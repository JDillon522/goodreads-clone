import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import type { ShelfResponse } from '../../core/api/api.types';
import { Auth } from '../../core/auth/auth';
import { Library as LibraryService } from '../../core/library/library';
import { SessionStore } from '../../core/session/session-store';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';

/**
 * Authenticated app shell with navigation, shelf links, session controls, and theme access.
 *
 * The shell listens to library and shelf revision signals so sidebar shelf links
 * stay current after mutations elsewhere in the app.
 */
@Component({
  selector: 'app-app-shell',
  imports: [DatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(Auth);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);

  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(Theme);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly isLoadingShelves = signal(true);
  protected readonly shelfError = signal<string | null>(null);
  /**
   * Reloads sidebar shelves whenever shelf definitions or library membership changes.
   */
  public constructor() {
    effect(() => {
      this.shelvesService.version();
      this.library.version();
      void this.loadShelves();
    });
  }
  /**
   * Signs out and returns to the public landing screen.
   */
  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }
  /**
   * Loads active shelves for sidebar navigation.
   */
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
