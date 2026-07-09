import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Theme } from './core/theme/theme';

/**
 * Root application component.
 *
 * Injecting Theme eagerly starts its preference effect before routed screens render.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly theme = inject(Theme);
  /**
   * Touches the theme signal so the injected service is retained and initialized.
   */
  public constructor() {
    this.theme.preference();
  }
}
