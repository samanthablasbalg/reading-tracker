import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function runGuard(): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
  }

  it('allows navigation when there is no session', async () => {
    const resultPromise = firstValueFrom(runGuard());
    httpTesting.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await resultPromise).toBe(true);
  });

  it('redirects to /currently-reading when a session exists', async () => {
    const router = TestBed.inject(Router);
    const resultPromise = firstValueFrom(runGuard());
    httpTesting.expectOne('/api/auth/me').flush({ id: 'user-1', email: 'me@example.com' });

    expect(await resultPromise).toEqual(router.createUrlTree(['/currently-reading']));
  });
});
