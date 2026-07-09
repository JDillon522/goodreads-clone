import { inject, Injectable, signal } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  AdminUserResponse,
  CreateAdminUserRequest,
  CreateShelfRequest,
  DeleteShelfResponse,
  ShelfResponse,
  UpdateAdminUserRequest,
  UpdateShelfOrderRequest,
  UpdateShelfRequest,
} from '../api/api.types';

/**
 * Admin API wrapper for user and per-user shelf management.
 *
 * Mutating calls increment a revision signal so admin screens can refresh after
 * cross-cutting operations such as deactivation, hard deletion, and reorder.
 */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);
  private readonly revision = signal(0);

  public readonly version = this.revision.asReadonly();
  /**
   * Lists authenticated users visible to the admin.
   */
  public listUsers(): Promise<AdminUserResponse[]> {
    return this.api.get<AdminUserResponse[]>('/api/admin/users');
  }
  /**
   * Creates an authenticated user through the admin endpoint.
   */
  public async createUser(request: CreateAdminUserRequest): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse, CreateAdminUserRequest>(
      '/api/admin/users',
      request,
    );
    this.markChanged();
    return response;
  }
  /**
   * Updates profile, role, username, or password for one managed user.
   */
  public async updateUser(
    userId: string,
    request: UpdateAdminUserRequest,
  ): Promise<AdminUserResponse> {
    const response = await this.api.patch<AdminUserResponse, UpdateAdminUserRequest>(
      `/api/admin/users/${userId}`,
      request,
    );
    this.markChanged();
    return response;
  }
  /**
   * Hard-deletes a user and relies on backend cascade cleanup.
   */
  public async deleteUser(userId: string): Promise<void> {
    await this.api.delete(`/api/admin/users/${userId}`);
    this.markChanged();
  }
  /**
   * Deactivates a user without deleting their account data.
   */
  public async deactivateUser(userId: string): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse>(
      `/api/admin/users/${userId}/deactivate`,
    );
    this.markChanged();
    return response;
  }
  /**
   * Reactivates a previously deactivated user.
   */
  public async reactivateUser(userId: string): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse>(
      `/api/admin/users/${userId}/reactivate`,
    );
    this.markChanged();
    return response;
  }
  /**
   * Lists shelves for a managed user, including admin-visible inactive shelves.
   */
  public listShelves(userId: string): Promise<ShelfResponse[]> {
    return this.api.get<ShelfResponse[]>(`/api/admin/users/${userId}/shelves`);
  }
  /**
   * Creates a shelf for a managed user rather than the signed-in admin.
   */
  public async createShelf(userId: string, request: CreateShelfRequest): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse, CreateShelfRequest>(
      `/api/admin/users/${userId}/shelves`,
      request,
    );
    this.markChanged();
    return response;
  }
  /**
   * Updates a managed user's shelf metadata.
   */
  public async updateShelf(
    userId: string,
    shelfId: string,
    request: UpdateShelfRequest,
  ): Promise<ShelfResponse> {
    const response = await this.api.patch<ShelfResponse, UpdateShelfRequest>(
      `/api/admin/users/${userId}/shelves/${shelfId}`,
      request,
    );
    this.markChanged();
    return response;
  }
  /**
   * Hard-deletes a managed user's shelf and returns affected-book details.
   */
  public async deleteShelf(userId: string, shelfId: string): Promise<DeleteShelfResponse> {
    const response = await this.api.delete<DeleteShelfResponse>(
      `/api/admin/users/${userId}/shelves/${shelfId}`,
    );
    this.markChanged();
    return response;
  }
  /**
   * Soft-deactivates a managed user's shelf.
   */
  public async deactivateShelf(userId: string, shelfId: string): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse>(
      `/api/admin/users/${userId}/shelves/${shelfId}/deactivate`,
    );
    this.markChanged();
    return response;
  }
  /**
   * Restores a managed user's deactivated shelf.
   */
  public async reactivateShelf(userId: string, shelfId: string): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse>(
      `/api/admin/users/${userId}/shelves/${shelfId}/reactivate`,
    );
    this.markChanged();
    return response;
  }
  /**
   * Persists a managed user's complete shelf order.
   */
  public async updateShelfOrder(
    userId: string,
    request: UpdateShelfOrderRequest,
  ): Promise<ShelfResponse[]> {
    const response = await this.api.put<ShelfResponse[], UpdateShelfOrderRequest>(
      `/api/admin/users/${userId}/shelves/order`,
      request,
    );
    this.markChanged();
    return response;
  }
  /**
   * Notifies admin consumers that user or shelf data changed.
   */
  private markChanged(): void {
    this.revision.update((value) => value + 1);
  }
}
