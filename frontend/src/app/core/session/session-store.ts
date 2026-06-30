import { computed, Injectable, signal } from '@angular/core';

import type { AuthTokenResponse, GuestSessionResponse } from '../api/api.types';

type SessionKind = 'anonymous' | 'guest' | 'user';

const accessTokenKey = 'bookshelf.accessToken';
const refreshTokenKey = 'bookshelf.refreshToken';
const userEmailKey = 'bookshelf.userEmail';
const guestTokenKey = 'bookshelf.guestToken';
const guestExpiresAtKey = 'bookshelf.guestExpiresAt';
const guestDirtyKey = 'bookshelf.guestDirty';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly accessTokenValue = signal(this.readLocal(accessTokenKey));
  private readonly refreshTokenValue = signal(this.readLocal(refreshTokenKey));
  private readonly userEmailValue = signal(this.readLocal(userEmailKey));
  private readonly guestTokenValue = signal(this.readSession(guestTokenKey));
  private readonly guestExpiresAtValue = signal(this.readSession(guestExpiresAtKey));
  private readonly guestDirtyValue = signal(this.readSession(guestDirtyKey) === 'true');

  public readonly sessionKind = computed<SessionKind>(() => {
    if (this.guestTokenValue()) {
      return 'guest';
    }

    if (this.accessTokenValue()) {
      return 'user';
    }

    return 'anonymous';
  });

  public readonly bearerToken = computed(() => this.guestTokenValue() ?? this.accessTokenValue());
  public readonly refreshToken = this.refreshTokenValue.asReadonly();
  public readonly userEmail = this.userEmailValue.asReadonly();
  public readonly guestExpiresAt = this.guestExpiresAtValue.asReadonly();
  public readonly guestHasUnsavedChanges = this.guestDirtyValue.asReadonly();
  public readonly isGuest = computed(() => this.sessionKind() === 'guest');
  public readonly isSignedIn = computed(() => this.sessionKind() === 'user');
  public readonly hasSession = computed(() => this.sessionKind() !== 'anonymous');

  public setAuthSession(response: AuthTokenResponse): void {
    this.clearGuestSession();
    this.writeLocal(accessTokenKey, response.accessToken);
    this.writeLocal(refreshTokenKey, response.refreshToken);
    this.writeLocal(userEmailKey, response.user.email);
    this.accessTokenValue.set(response.accessToken);
    this.refreshTokenValue.set(response.refreshToken);
    this.userEmailValue.set(response.user.email);
  }

  public setGuestSession(response: GuestSessionResponse): void {
    this.clearAuthSession();
    this.writeSession(guestTokenKey, response.guestToken);
    this.writeSession(guestExpiresAtKey, response.expiresAt);
    this.writeSession(guestDirtyKey, 'false');
    this.guestTokenValue.set(response.guestToken);
    this.guestExpiresAtValue.set(response.expiresAt);
    this.guestDirtyValue.set(false);
  }

  public markGuestChanged(): void {
    if (!this.isGuest()) {
      return;
    }

    this.writeSession(guestDirtyKey, 'true');
    this.guestDirtyValue.set(true);
  }

  public clear(): void {
    this.clearAuthSession();
    this.clearGuestSession();
  }

  private clearAuthSession(): void {
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(refreshTokenKey);
    localStorage.removeItem(userEmailKey);
    this.accessTokenValue.set(null);
    this.refreshTokenValue.set(null);
    this.userEmailValue.set(null);
  }

  private clearGuestSession(): void {
    sessionStorage.removeItem(guestTokenKey);
    sessionStorage.removeItem(guestExpiresAtKey);
    sessionStorage.removeItem(guestDirtyKey);
    this.guestTokenValue.set(null);
    this.guestExpiresAtValue.set(null);
    this.guestDirtyValue.set(false);
  }

  private readLocal(key: string): string | null {
    return localStorage.getItem(key);
  }

  private writeLocal(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  private readSession(key: string): string | null {
    return sessionStorage.getItem(key);
  }

  private writeSession(key: string, value: string): void {
    sessionStorage.setItem(key, value);
  }
}
