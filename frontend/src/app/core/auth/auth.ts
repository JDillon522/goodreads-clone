import { inject, Injectable } from '@angular/core';

import { ApiClient } from '../api/api-client';
import type {
  AuthTokenResponse,
  AuthUserResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  SigninRequest,
  SignoutResponse,
  SignupRequest,
} from '../api/api.types';
import { SessionStore } from '../session/session-store';

/**
 * Authentication API wrapper.
 *
 * Methods that return tokens immediately update `SessionStore` so route guards,
 * interceptors, and nav state react to sign-in, sign-up, and reset-confirm flows.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);
  /**
   * Signs in with username or email and stores the returned auth session.
   */
  public async signIn(request: SigninRequest): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, SigninRequest>(
      '/api/auth/signin',
      request,
    );
    this.session.setAuthSession(response);
    return response;
  }
  /**
   * Creates an account and stores the initial auth session.
   */
  public async signUp(request: SignupRequest): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, SignupRequest>(
      '/api/auth/signup',
      request,
    );
    this.session.setAuthSession(response);
    return response;
  }
  /**
   * Loads the currently authenticated user profile from the backend.
   */
  public currentUser(): Promise<AuthUserResponse> {
    return this.api.get<AuthUserResponse>('/api/auth/me');
  }
  /**
   * Requests a password reset token for the provided account email.
   */
  public requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.api.post<PasswordResetResponse, PasswordResetRequest>(
      '/api/auth/password-reset/request',
      request,
    );
  }
  /**
   * Confirms a reset token and stores the new auth session returned by the backend.
   */
  public async confirmPasswordReset(
    request: PasswordResetConfirmRequest,
  ): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, PasswordResetConfirmRequest>(
      '/api/auth/password-reset/confirm',
      request,
    );
    this.session.setAuthSession(response);
    return response;
  }
  /**
   * Clears local session state before optionally revoking the refresh token server-side.
   */
  public async signOut(): Promise<SignoutResponse | null> {
    const refreshToken = this.session.refreshToken();
    this.session.clear();

    if (!refreshToken) {
      return null;
    }

    return this.api.post<SignoutResponse, { refreshToken: string }>('/api/auth/signout', {
      refreshToken,
    });
  }
}
