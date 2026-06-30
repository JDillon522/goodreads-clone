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

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  public async signIn(request: SigninRequest): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, SigninRequest>('/api/auth/signin', request);
    this.session.setAuthSession(response);
    return response;
  }

  public async signUp(request: SignupRequest): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, SignupRequest>('/api/auth/signup', request);
    this.session.setAuthSession(response);
    return response;
  }

  public currentUser(): Promise<AuthUserResponse> {
    return this.api.get<AuthUserResponse>('/api/auth/me');
  }

  public requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.api.post<PasswordResetResponse, PasswordResetRequest>('/api/auth/password-reset/request', request);
  }

  public async confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<AuthTokenResponse> {
    const response = await this.api.post<AuthTokenResponse, PasswordResetConfirmRequest>(
      '/api/auth/password-reset/confirm',
      request,
    );
    this.session.setAuthSession(response);
    return response;
  }

  public async signOut(): Promise<SignoutResponse | null> {
    const refreshToken = this.session.refreshToken();
    this.session.clear();

    if (!refreshToken) {
      return null;
    }

    return this.api.post<SignoutResponse, { refreshToken: string }>('/api/auth/signout', { refreshToken });
  }
}
