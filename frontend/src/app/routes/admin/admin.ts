import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, email, minLength, required, submit } from '@angular/forms/signals';

import { AdminApi } from '../../core/admin/admin';
import type {
  AdminUserResponse,
  CreateAdminUserRequest,
  ShelfResponse,
  UpdateAdminUserRequest,
} from '../../core/api/api.types';
import { UiFormControl } from '../../shared/ui/form-control/form-control';

/**
 * Admin management route for authenticated users and their shelves.
 *
 * The selected user scopes every shelf operation. User and shelf changes reload
 * the relevant lists after each mutation so the page reflects deactivation,
 * deletion, and reorder side effects returned by the backend.
 */
type UserRole = AdminUserResponse['role'];

@Component({
  selector: 'app-admin',
  imports: [DatePipe, UiFormControl],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly admin = inject(AdminApi);
  private readonly createUserModel = signal({
    displayName: '',
    email: '',
    password: '',
    role: 'USER' as UserRole,
    username: '',
  });
  private readonly editUserModel = signal({
    displayName: '',
    email: '',
    password: '',
    role: 'USER' as UserRole,
    username: '',
  });
  private readonly createShelfModel = signal({ name: '' });
  private readonly editShelfModel = signal({ name: '' });

  protected readonly roleOptions: readonly UserRole[] = ['USER', 'ADMIN'];
  protected readonly users = signal<AdminUserResponse[]>([]);
  protected readonly shelves = signal<ShelfResponse[]>([]);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly selectedShelfId = signal<string | null>(null);
  protected readonly isLoadingUsers = signal(true);
  protected readonly isLoadingShelves = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedUser = computed(
    () => this.users().find((user) => user.id === this.selectedUserId()) ?? null,
  );
  protected readonly selectedShelf = computed(
    () => this.shelves().find((shelf) => shelf.id === this.selectedShelfId()) ?? null,
  );
  protected readonly createUserForm = form(this.createUserModel, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Use a valid email address.' });
    required(path.password, { message: 'Password is required.' });
    minLength(path.password, 8, { message: 'Use at least 8 characters.' });
  });
  protected readonly editUserForm = form(this.editUserModel, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Use a valid email address.' });
  });
  protected readonly createShelfForm = form(this.createShelfModel, (path) => {
    required(path.name, { message: 'Shelf name is required.' });
    minLength(path.name, 2, { message: 'Use at least 2 characters.' });
  });
  protected readonly editShelfForm = form(this.editShelfModel, (path) => {
    required(path.name, { message: 'Shelf name is required.' });
    minLength(path.name, 2, { message: 'Use at least 2 characters.' });
  });
  /**
   * Loads the user list on entry and automatically selects the first user when available.
   */
  public constructor() {
    void this.loadUsers();
  }
  /**
   * Allows shelf deactivation only for active, non-Unshelved shelves.
   */
  protected canDeactivateShelf(shelf: ShelfResponse): boolean {
    return shelf.slug !== 'unshelved' && !shelf.deactivatedAt;
  }
  /**
   * Blocks hard deletion of Unshelved because books need a durable fallback shelf.
   */
  protected canDeleteShelf(shelf: ShelfResponse): boolean {
    return shelf.slug !== 'unshelved';
  }
  /**
   * Selects a shelf and seeds the edit form from its current name.
   */
  protected selectShelf(shelf: ShelfResponse): void {
    this.selectedShelfId.set(shelf.id);
    this.editShelfModel.set({ name: shelf.name });
  }
  /**
   * Selects a user, resets shelf selection, seeds the user edit form, and loads that user's shelves.
   */
  protected async selectUser(user: AdminUserResponse): Promise<void> {
    this.selectedUserId.set(user.id);
    this.selectedShelfId.set(null);
    this.editUserModel.set({
      displayName: user.displayName ?? '',
      email: user.email,
      password: '',
      role: user.role,
      username: user.username ?? '',
    });
    await this.loadShelves(user.id);
  }
  /**
   * Creates a shelf for the selected user rather than the signed-in admin account.
   */
  protected async submitCreateShelf(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const user = this.selectedUser();

    if (!user) {
      return;
    }

    this.error.set(null);
    this.message.set(null);

    try {
      const successful = await submit(this.createShelfForm, async (formTree) => {
        const name = formTree().value().name.trim();
        await this.admin.createShelf(user.id, { name });
        this.createShelfModel.set({ name: '' });
        this.message.set(`${name} shelf created.`);
        await this.loadShelves(user.id);
      });

      if (!successful) {
        this.error.set('Check the highlighted form fields.');
      }
    } catch {
      this.error.set('Admin action failed.');
    }
  }
  /**
   * Creates a managed user and selects it after the refreshed list is loaded.
   */
  protected async submitCreateUser(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    this.error.set(null);
    this.message.set(null);

    try {
      const successful = await submit(this.createUserForm, async (formTree) => {
        const value = formTree().value();
        const request: CreateAdminUserRequest = {
          email: value.email.trim(),
          password: value.password,
          role: value.role,
        };

        // Optional profile fields are omitted when blank so backend defaults and
        // uniqueness checks do not receive empty strings.
        if (value.displayName.trim()) {
          request.displayName = value.displayName.trim();
        }

        if (value.username.trim()) {
          request.username = value.username.trim();
        }

        const user = await this.admin.createUser(request);
        this.createUserModel.set({
          displayName: '',
          email: '',
          password: '',
          role: 'USER',
          username: '',
        });
        this.message.set(`${user.email} created.`);
        await this.loadUsers(user.id);
      });

      if (!successful) {
        this.error.set('Check the highlighted form fields.');
      }
    } catch {
      this.error.set('Admin action failed.');
    }
  }
  /**
   * Renames the selected shelf within the selected user's shelf collection.
   */
  protected async submitUpdateShelf(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const user = this.selectedUser();
    const shelf = this.selectedShelf();

    if (!user || !shelf) {
      return;
    }

    this.error.set(null);
    this.message.set(null);

    try {
      const successful = await submit(this.editShelfForm, async (formTree) => {
        const name = formTree().value().name.trim();
        await this.admin.updateShelf(user.id, shelf.id, { name });
        this.message.set(`${name} shelf updated.`);
        await this.loadShelves(user.id);
      });

      if (!successful) {
        this.error.set('Check the highlighted form fields.');
      }
    } catch {
      this.error.set('Admin action failed.');
    }
  }
  /**
   * Updates profile fields and role, sending a password only when the admin entered one.
   */
  protected async submitUpdateUser(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const user = this.selectedUser();

    if (!user) {
      return;
    }

    this.error.set(null);
    this.message.set(null);

    try {
      const successful = await submit(this.editUserForm, async (formTree) => {
        const value = formTree().value();
        const request: UpdateAdminUserRequest = {
          displayName: value.displayName.trim() || null,
          email: value.email.trim(),
          role: value.role,
          username: value.username.trim() || null,
        };

        if (value.password.trim()) {
          request.password = value.password;
        }

        const updated = await this.admin.updateUser(user.id, request);
        this.message.set(`${updated.email} updated.`);
        await this.loadUsers(updated.id);
      });

      if (!successful) {
        this.error.set('Check the highlighted form fields.');
      }
    } catch {
      this.error.set('Admin action failed.');
    }
  }
  /**
   * Soft-deactivates the selected shelf without deleting the row or its historical memberships.
   */
  protected async deactivateSelectedShelf(): Promise<void> {
    const user = this.selectedUser();
    const shelf = this.selectedShelf();

    if (!user || !shelf || !this.canDeactivateShelf(shelf)) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.deactivateShelf(user.id, shelf.id);
      this.message.set(`${shelf.name} shelf deactivated.`);
      await this.loadShelves(user.id);
    });
  }
  /**
   * Soft-deactivates the selected user so they can no longer sign in or call APIs.
   */
  protected async deactivateSelectedUser(): Promise<void> {
    const user = this.selectedUser();

    if (!user || user.deactivatedAt) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.deactivateUser(user.id);
      this.message.set(`${user.email} deactivated.`);
      await this.loadUsers(user.id);
    });
  }
  /**
   * Hard-deletes the selected shelf after confirmation, except for protected Unshelved.
   */
  protected async deleteSelectedShelf(): Promise<void> {
    const user = this.selectedUser();
    const shelf = this.selectedShelf();

    if (
      !user ||
      !shelf ||
      !this.canDeleteShelf(shelf) ||
      !globalThis.confirm(`Delete ${shelf.name}?`)
    ) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.deleteShelf(user.id, shelf.id);
      this.selectedShelfId.set(null);
      this.message.set(`${shelf.name} shelf deleted.`);
      await this.loadShelves(user.id);
    });
  }
  /**
   * Hard-deletes the selected user and clears local shelf state before reloading the user list.
   */
  protected async deleteSelectedUser(): Promise<void> {
    const user = this.selectedUser();

    if (!user || !globalThis.confirm(`Hard-delete ${user.email}?`)) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.deleteUser(user.id);
      this.selectedUserId.set(null);
      this.selectedShelfId.set(null);
      this.shelves.set([]);
      this.message.set(`${user.email} deleted.`);
      await this.loadUsers();
    });
  }
  /**
   * Reorders shelves for the selected user using a one-step local array move.
   */
  protected async moveShelf(shelf: ShelfResponse, offset: -1 | 1): Promise<void> {
    const user = this.selectedUser();
    const currentShelves = this.shelves();
    const currentIndex = currentShelves.findIndex((candidate) => candidate.id === shelf.id);
    const nextIndex = currentIndex + offset;

    if (!user || currentIndex < 0 || nextIndex < 0 || nextIndex >= currentShelves.length) {
      return;
    }

    const reordered = [...currentShelves];
    const [moved] = reordered.splice(currentIndex, 1);

    reordered.splice(nextIndex, 0, moved);

    await this.runAction(async () => {
      this.shelves.set(
        await this.admin.updateShelfOrder(user.id, { shelfIds: reordered.map((item) => item.id) }),
      );
      this.message.set(`${shelf.name} reordered.`);
    });
  }
  /**
   * Restores a deactivated shelf for the selected user.
   */
  protected async reactivateSelectedShelf(): Promise<void> {
    const user = this.selectedUser();
    const shelf = this.selectedShelf();

    if (!user || !shelf || !shelf.deactivatedAt) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.reactivateShelf(user.id, shelf.id);
      this.message.set(`${shelf.name} shelf reactivated.`);
      await this.loadShelves(user.id);
    });
  }
  /**
   * Restores a deactivated user and refreshes the selected row.
   */
  protected async reactivateSelectedUser(): Promise<void> {
    const user = this.selectedUser();

    if (!user || !user.deactivatedAt) {
      return;
    }

    await this.runAction(async () => {
      await this.admin.reactivateUser(user.id);
      this.message.set(`${user.email} reactivated.`);
      await this.loadUsers(user.id);
    });
  }
  /**
   * Loads shelves for the selected user scope, including admin-visible inactive shelves.
   */
  private async loadShelves(userId: string): Promise<void> {
    this.isLoadingShelves.set(true);
    this.error.set(null);

    try {
      this.shelves.set(await this.admin.listShelves(userId));
    } catch {
      this.error.set('Shelves could not be loaded.');
    } finally {
      this.isLoadingShelves.set(false);
    }
  }
  /**
   * Loads users and keeps a requested user selected after create/update/deactivate actions.
   */
  private async loadUsers(selectedUserId?: string): Promise<void> {
    this.isLoadingUsers.set(true);
    this.error.set(null);

    try {
      const users = await this.admin.listUsers();
      this.users.set(users);
      const selected = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null;

      if (selected) {
        await this.selectUser(selected);
      }
    } catch {
      this.error.set('Users could not be loaded.');
    } finally {
      this.isLoadingUsers.set(false);
    }
  }
  /**
   * Wraps admin mutations with shared message/error clearing and failure handling.
   */
  private async runAction(action: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.message.set(null);

    try {
      await action();
    } catch {
      this.error.set('Admin action failed.');
    }
  }
}
