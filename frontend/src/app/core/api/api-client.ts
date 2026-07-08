import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

type QueryValue = boolean | number | string | undefined;
type QueryParams = Record<string, QueryValue>;

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  public get<TResponse>(path: string, query?: QueryParams): Promise<TResponse> {
    return firstValueFrom(this.http.get<TResponse>(path, { params: this.toParams(query) }));
  }

  public post<TResponse, TBody extends object = object>(path: string, body?: TBody): Promise<TResponse> {
    return firstValueFrom(this.http.post<TResponse>(path, body ?? {}));
  }

  public put<TResponse, TBody extends object = object>(path: string, body: TBody): Promise<TResponse> {
    return firstValueFrom(this.http.put<TResponse>(path, body));
  }

  public patch<TResponse, TBody extends object = object>(path: string, body: TBody): Promise<TResponse> {
    return firstValueFrom(this.http.patch<TResponse>(path, body));
  }

  public delete<TResponse = void>(path: string): Promise<TResponse> {
    return firstValueFrom(this.http.delete<TResponse>(path));
  }

  private toParams(query?: QueryParams): HttpParams {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        params = params.set(key, String(value));
      }
    }

    return params;
  }
}
