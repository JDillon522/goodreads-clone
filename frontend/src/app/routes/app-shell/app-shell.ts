import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Auth } from '../../core/auth/auth';
import { SessionStore } from '../../core/session/session-store';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';
import type { ShelfResponse } from '../../core/api/api.types';

@Component({
  selector: 'app-app-shell',
  imports: [DatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly shelvesService = inject(Shelves);

  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(Theme);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly isLoadingShelves = signal(true);

  public constructor() {
    void this.loadShelves();
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/']);
  }

  private async loadShelves(): Promise<void> {
    try {
      this.shelves.set(await this.shelvesService.list());
    } finally {
      this.isLoadingShelves.set(false);
    }
  }
}
