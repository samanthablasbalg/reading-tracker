import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { AuthService as AuthApiService } from './api/generated/auth/auth.service';
import type { AuthMe200 } from './api/generated/readingTracker.schemas';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly currentUserSignal = signal<AuthMe200 | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();

  checkSession(): Observable<AuthMe200 | null> {
    return this.authApi.authMe().pipe(
      tap((user) => this.currentUserSignal.set(user)),
      catchError(() => {
        this.currentUserSignal.set(null);
        return of(null);
      }),
    );
  }

  login(): void {
    window.location.href = '/api/auth/login';
  }

  logout(): Observable<unknown> {
    return this.authApi.authLogout().pipe(tap(() => this.currentUserSignal.set(null)));
  }
}
