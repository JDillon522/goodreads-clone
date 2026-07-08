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

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);
  private readonly revision = signal(0);

  public readonly version = this.revision.asReadonly();

  public listUsers(): Promise<AdminUserResponse[]> {
    return this.api.get<AdminUserResponse[]>('/api/admin/users');
  }

  public async createUser(request: CreateAdminUserRequest): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse, CreateAdminUserRequest>('/api/admin/users', request);
    this.markChanged();
    return response;
  }

  public async updateUser(userId: string, request: UpdateAdminUserRequest): Promise<AdminUserResponse> {
    const response = await this.api.patch<AdminUserResponse, UpdateAdminUserRequest>(
      `/api/admin/users/${userId}`,
      request,
    );
    this.markChanged();
    return response;
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.api.delete(`/api/admin/users/${userId}`);
    this.markChanged();
  }

  public async deactivateUser(userId: string): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse>(`/api/admin/users/${userId}/deactivate`);
    this.markChanged();
    return response;
  }

  public async reactivateUser(userId: string): Promise<AdminUserResponse> {
    const response = await this.api.post<AdminUserResponse>(`/api/admin/users/${userId}/reactivate`);
    this.markChanged();
    return response;
  }

  public listShelves(userId: string): Promise<ShelfResponse[]> {
    return this.api.get<ShelfResponse[]>(`/api/admin/users/${userId}/shelves`);
  }

  public async createShelf(userId: string, request: CreateShelfRequest): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse, CreateShelfRequest>(
      `/api/admin/users/${userId}/shelves`,
      request,
    );
    this.markChanged();
    return response;
  }

  public async updateShelf(userId: string, shelfId: string, request: UpdateShelfRequest): Promise<ShelfResponse> {
    const response = await this.api.patch<ShelfResponse, UpdateShelfRequest>(
      `/api/admin/users/${userId}/shelves/${shelfId}`,
      request,
    );
    this.markChanged();
    return response;
  }

  public async deleteShelf(userId: string, shelfId: string): Promise<DeleteShelfResponse> {
    const response = await this.api.delete<DeleteShelfResponse>(`/api/admin/users/${userId}/shelves/${shelfId}`);
    this.markChanged();
    return response;
  }

  public async deactivateShelf(userId: string, shelfId: string): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse>(
      `/api/admin/users/${userId}/shelves/${shelfId}/deactivate`,
    );
    this.markChanged();
    return response;
  }

  public async reactivateShelf(userId: string, shelfId: string): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse>(
      `/api/admin/users/${userId}/shelves/${shelfId}/reactivate`,
    );
    this.markChanged();
    return response;
  }

  public async updateShelfOrder(userId: string, request: UpdateShelfOrderRequest): Promise<ShelfResponse[]> {
    const response = await this.api.put<ShelfResponse[], UpdateShelfOrderRequest>(
      `/api/admin/users/${userId}/shelves/order`,
      request,
    );
    this.markChanged();
    return response;
  }

  private markChanged(): void {
    this.revision.update((value) => value + 1);
  }
}
