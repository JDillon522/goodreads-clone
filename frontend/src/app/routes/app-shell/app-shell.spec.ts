import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ShelfResponse } from '../../core/api/api.types';
import { Auth } from '../../core/auth/auth';
import { Library as LibraryService } from '../../core/library/library';
import { SessionStore } from '../../core/session/session-store';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';
import { AppShell } from './app-shell';

const timestamp = '2026-07-08T12:00:00.000Z';

function shelf(
  id: string,
  name: string,
  position: number,
  slug = name.toLowerCase(),
): ShelfResponse {
  return {
    createdAt: timestamp,
    deactivatedAt: null,
    id,
    isDefault: slug !== 'fantasy',
    itemCount: 0,
    name,
    position,
    slug,
    updatedAt: timestamp,
  };
}

class MockAuth {
  public readonly signOut = vi.fn().mockResolvedValue(null);
}

class MockLibrary {
  private readonly revision = signal(0);
  public readonly version = this.revision.asReadonly();
}

class MockSessionStore {
  public readonly guestExpiresAt = signal(timestamp);
  public readonly guestHasUnsavedChanges = signal(false);
  public readonly isAdmin = signal(false);
  public readonly isGuest = signal(false);
  public readonly isSignedIn = signal(true);
}

class MockShelves {
  private readonly revision = signal(0);
  private currentShelves = [
    shelf('unshelved', 'Unshelved', 0, 'unshelved'),
    shelf('read', 'Read', 1, 'read'),
    shelf('fantasy', 'Fantasy', 2, 'fantasy'),
  ];

  public readonly version = this.revision.asReadonly();
  public readonly list = vi.fn(async () => this.currentShelves);
}

class MockTheme {
  public readonly effectiveTheme = signal<'dark' | 'light'>('light');
  public readonly toggle = vi.fn();
}

describe('AppShell navigation shelves', () => {
  let shelves: MockShelves;

  beforeEach(async () => {
    shelves = new MockShelves();

    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([]),
        { provide: Auth, useClass: MockAuth },
        { provide: LibraryService, useClass: MockLibrary },
        { provide: SessionStore, useClass: MockSessionStore },
        { provide: Shelves, useValue: shelves },
        { provide: Theme, useClass: MockTheme },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lists shelves in the sidebar and links to shelf management', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    const manageLink = element.querySelector<HTMLAnchorElement>('a[aria-label="Manage shelves"]')!;

    expect(text).toContain('Unshelved');
    expect(text).toContain('Read');
    expect(text).toContain('Fantasy');
    expect(manageLink.getAttribute('href')).toBe('/app/shelves/manage');
    expect(element.querySelector('button[aria-label="Move Fantasy up"]')).toBeNull();
    expect(element.querySelector('button[aria-label="Rename Fantasy"]')).toBeNull();
    expect(element.querySelector('button[aria-label="Delete Fantasy"]')).toBeNull();
  });

  it('signs out from the shell action', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();

    expect((TestBed.inject(Auth) as unknown as MockAuth).signOut).toHaveBeenCalled();
  });
});
