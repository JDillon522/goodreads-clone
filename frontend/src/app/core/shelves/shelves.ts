import { inject, Injectable, signal } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  CreateShelfRequest,
  DeleteShelfResponse,
  ShelfResponse,
  UpdateShelfOrderRequest,
  UpdateShelfRequest,
} from '../api/api.types';
import { SessionStore } from '../session/session-store';

@Injectable({ providedIn: 'root' })
export class Shelves {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  private readonly revision = signal(0);

  public readonly version = this.revision.asReadonly();

  public list(): Promise<ShelfResponse[]> {
    return this.api.get<ShelfResponse[]>('/api/shelves');
  }

  public async create(request: CreateShelfRequest): Promise<ShelfResponse> {
    const response = await this.api.post<ShelfResponse, CreateShelfRequest>('/api/shelves', request);
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }

  public async update(id: string, request: UpdateShelfRequest): Promise<ShelfResponse> {
    const response = await this.api.patch<ShelfResponse, UpdateShelfRequest>(`/api/shelves/${id}`, request);
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }

  public async updateOrder(request: UpdateShelfOrderRequest): Promise<ShelfResponse[]> {
    const response = await this.api.put<ShelfResponse[], UpdateShelfOrderRequest>('/api/shelves/order', request);
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }

  public async delete(id: string): Promise<DeleteShelfResponse> {
    const response = await this.api.delete<DeleteShelfResponse>(`/api/shelves/${id}`);
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }

  private markChanged(): void {
    this.revision.update((value) => value + 1);
  }
}
