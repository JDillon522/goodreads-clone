import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { DeleteShelfResponse, LibraryItemResponse, ShelfResponse } from '../../core/api/api.types';
import { Auth } from '../../core/auth/auth';
import { Library as LibraryService } from '../../core/library/library';
import { SessionStore } from '../../core/session/session-store';
import { Shelves } from '../../core/shelves/shelves';
import { Theme } from '../../core/theme/theme';
import { AppShell } from './app-shell';

const timestamp = '2026-07-08T12:00:00.000Z';

function shelf(id: string, name: string, position: number, slug = name.toLowerCase()): ShelfResponse {
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

function item(id: string, title: string, shelves: LibraryItemResponse['shelves']): LibraryItemResponse {
  return {
    book: {
      authors: ['Author'],
      genres: [],
      id: `${id}-book`,
      sourceId: `${id}-source`,
      sourceProvider: 'SAMPLE',
      title,
    },
    createdAt: timestamp,
    dateAdded: timestamp,
    dedupeKey: id,
    id,
    shelves,
    status: 'WANT_TO_READ',
    updatedAt: timestamp,
  };
}

class MockAuth {
  public readonly signOut = vi.fn().mockResolvedValue(null);
}

class MockLibrary {
  private readonly revision = signal(0);
  public readonly version = this.revision.asReadonly();
  public readonly list = vi.fn<(_: string) => Promise<LibraryItemResponse[]>>().mockResolvedValue([]);
}

class MockSessionStore {
  public readonly guestExpiresAt = signal(timestamp);
  public readonly guestHasUnsavedChanges = signal(false);
  public readonly isAdmin = signal(false);
  public readonly isGuest = signal(false);
}

class MockShelves {
  private readonly revision = signal(0);
  private currentShelves = [shelf('unshelved', 'Unshelved', 0, 'unshelved'), shelf('read', 'Read', 1, 'read'), shelf('fantasy', 'Fantasy', 2, 'fantasy')];

  public readonly version = this.revision.asReadonly();
  public readonly create = vi.fn(async ({ name }: { name: string }) => {
    const created = shelf(name.toLowerCase(), name, this.currentShelves.length, name.toLowerCase());
    this.currentShelves = [...this.currentShelves, created];
    this.revision.update((value) => value + 1);
    return created;
  });
  public readonly delete = vi.fn(async (id: string): Promise<DeleteShelfResponse> => ({
    affectedBooks: [],
    deletedShelfId: id,
    deletedShelfName: 'Fantasy',
    fallbackShelfId: null,
  }));
  public readonly list = vi.fn(async () => this.currentShelves);
  public readonly update = vi.fn(async (id: string, { name }: { name?: string }) => {
    this.currentShelves = this.currentShelves.map((candidate) =>
      candidate.id === id && name ? { ...candidate, name } : candidate,
    );
    this.revision.update((value) => value + 1);
    return this.currentShelves.find((candidate) => candidate.id === id)!;
  });
  public readonly updateOrder = vi.fn(async ({ shelfIds }: { shelfIds: string[] }) => {
    this.currentShelves = shelfIds.map((id, index) => ({ ...this.currentShelves.find((candidate) => candidate.id === id)!, position: index }));
    this.revision.update((value) => value + 1);
    return this.currentShelves;
  });
}

class MockTheme {
  public readonly effectiveTheme = signal<'dark' | 'light'>('light');
  public readonly toggle = vi.fn();
}

describe('AppShell shelf management', () => {
  let library: MockLibrary;
  let shelves: MockShelves;

  beforeEach(async () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
    library = new MockLibrary();
    shelves = new MockShelves();

    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([]),
        { provide: Auth, useClass: MockAuth },
        { provide: LibraryService, useValue: library },
        { provide: SessionStore, useClass: MockSessionStore },
        { provide: Shelves, useValue: shelves },
        { provide: Theme, useClass: MockTheme },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates shelves from the sidebar form', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('.shelf-create-form')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.value = 'Sci-Fi';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(shelves.create).toHaveBeenCalledWith({ name: 'Sci-Fi' });
  });

  it('renames shelves from the dialog', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Rename Read"]')!.click();
    await fixture.whenStable();

    const form = element.querySelector<HTMLDialogElement>('dialog')!.querySelector<HTMLFormElement>('form')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.value = 'Finished';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(shelves.update).toHaveBeenCalledWith('read', { name: 'Finished' });
  });

  it('deletes shelves after previewing affected books', async () => {
    library.list.mockResolvedValueOnce([item('item-1', 'A Book', [{ id: 'fantasy', name: 'Fantasy', position: 2, slug: 'fantasy' }])]);
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Delete Fantasy"]')!.click();
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.danger-button')!.click();
    await fixture.whenStable();

    expect(library.list).toHaveBeenCalledWith('fantasy');
    expect(shelves.delete).toHaveBeenCalledWith('fantasy');
  });

  it('reorders shelves through the normal user shelf controls', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Move Fantasy up"]')!.click();
    await fixture.whenStable();

    expect(shelves.updateOrder).toHaveBeenCalledWith({ shelfIds: ['unshelved', 'fantasy', 'read'] });
  });

  it('signs out from the shell action', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();

    expect((TestBed.inject(Auth) as unknown as MockAuth).signOut).toHaveBeenCalled();
  });
});
