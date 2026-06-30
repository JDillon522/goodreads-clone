import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  AddLibraryItemRequest,
  LibraryItemResponse,
  MoveLibraryItemRequest,
  UpdateLibraryItemRequest,
  UpdateProgressRequest,
} from '../api/api.types';
import { SessionStore } from '../session/session-store';

@Injectable({ providedIn: 'root' })
export class Library {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  public list(shelfId?: string): Promise<LibraryItemResponse[]> {
    return this.api.get<LibraryItemResponse[]>('/api/library', { shelfId });
  }

  public async add(request: AddLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.post<LibraryItemResponse, AddLibraryItemRequest>('/api/library', request);
    this.session.markGuestChanged();
    return response;
  }

  public get(id: string): Promise<LibraryItemResponse> {
    return this.api.get<LibraryItemResponse>(`/api/library/${id}`);
  }

  public async update(id: string, request: UpdateLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.patch<LibraryItemResponse, UpdateLibraryItemRequest>(`/api/library/${id}`, request);
    this.session.markGuestChanged();
    return response;
  }

  public async move(id: string, request: MoveLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.patch<LibraryItemResponse, MoveLibraryItemRequest>(`/api/library/${id}/shelf`, request);
    this.session.markGuestChanged();
    return response;
  }

  public async updateProgress(id: string, request: UpdateProgressRequest): Promise<LibraryItemResponse> {
    const response = await this.api.post<LibraryItemResponse, UpdateProgressRequest>(
      `/api/library/${id}/progress`,
      request,
    );
    this.session.markGuestChanged();
    return response;
  }

  public async delete(id: string): Promise<void> {
    await this.api.delete(`/api/library/${id}`);
    this.session.markGuestChanged();
  }
}
