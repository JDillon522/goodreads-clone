import { inject, Injectable, signal } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  AddLibraryItemRequest,
  AddLibraryItemShelfRequest,
  LibraryItemResponse,
  MoveLibraryItemRequest,
  ReplaceLibraryItemEditionRequest,
  UpdateLibraryItemRequest,
  UpdateProgressRequest,
} from '../api/api.types';
import { SessionStore } from '../session/session-store';

/**
 * Library API wrapper for the current owner, whether signed-in user or guest.
 *
 * Mutations bump a local revision signal so shelves/app shell screens can
 * refresh, and mark guest sessions dirty so temporary data-loss warnings remain
 * accurate.
 */
@Injectable({ providedIn: 'root' })
export class Library {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  private readonly revision = signal(0);

  public readonly version = this.revision.asReadonly();
  /**
   * Lists library items, optionally constrained to a shelf id.
   */
  public list(shelfId?: string): Promise<LibraryItemResponse[]> {
    return this.api.get<LibraryItemResponse[]>('/api/library', { shelfId });
  }
  /**
   * Adds a normalized book to the library and optionally to a starting shelf.
   */
  public async add(request: AddLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.post<LibraryItemResponse, AddLibraryItemRequest>(
      '/api/library',
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Loads one library item for detail editing.
   */
  public get(id: string): Promise<LibraryItemResponse> {
    return this.api.get<LibraryItemResponse>(`/api/library/${id}`);
  }
  /**
   * Updates item metadata such as status, rating, or notes.
   */
  public async update(id: string, request: UpdateLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.patch<LibraryItemResponse, UpdateLibraryItemRequest>(
      `/api/library/${id}`,
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Moves an item between the legacy single-shelf endpoint used by older flows.
   */
  public async move(id: string, request: MoveLibraryItemRequest): Promise<LibraryItemResponse> {
    const response = await this.api.patch<LibraryItemResponse, MoveLibraryItemRequest>(
      `/api/library/${id}/shelf`,
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Adds another shelf membership to an existing item.
   */
  public async addShelf(
    id: string,
    request: AddLibraryItemShelfRequest,
  ): Promise<LibraryItemResponse> {
    const response = await this.api.post<LibraryItemResponse, AddLibraryItemShelfRequest>(
      `/api/library/${id}/shelves`,
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Removes one shelf membership and returns the backend-adjusted item.
   */
  public async removeShelf(id: string, shelfId: string): Promise<LibraryItemResponse> {
    const response = await this.api.delete<LibraryItemResponse>(
      `/api/library/${id}/shelves/${shelfId}`,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Saves reading progress through the endpoint that applies progress/status rules.
   */
  public async updateProgress(
    id: string,
    request: UpdateProgressRequest,
  ): Promise<LibraryItemResponse> {
    const response = await this.api.post<LibraryItemResponse, UpdateProgressRequest>(
      `/api/library/${id}/progress`,
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Swaps the ISBN-owned edition while retaining the owner's personal library state.
   */
  public async replaceEdition(
    id: string,
    request: ReplaceLibraryItemEditionRequest,
  ): Promise<LibraryItemResponse> {
    const response = await this.api.patch<LibraryItemResponse, ReplaceLibraryItemEditionRequest>(
      `/api/library/${id}/edition`,
      request,
    );
    this.markChanged();
    this.session.markGuestChanged();
    return response;
  }
  /**
   * Deletes an item from the current owner's library.
   */
  public async delete(id: string): Promise<void> {
    await this.api.delete(`/api/library/${id}`);
    this.markChanged();
    this.session.markGuestChanged();
  }
  /**
   * Notifies signal subscribers that library-derived UI should refresh.
   */
  private markChanged(): void {
    this.revision.update((value) => value + 1);
  }
}
