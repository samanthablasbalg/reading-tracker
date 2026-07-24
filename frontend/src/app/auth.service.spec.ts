import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('checkSession sets currentUser on success', () => {
    service.checkSession().subscribe();

    httpTesting.expectOne('/api/auth/me').flush({ id: 'user-1', email: 'me@example.com' });

    expect(service.currentUser()).toEqual({ id: 'user-1', email: 'me@example.com' });
  });

  it('checkSession carries the picture through when present', () => {
    service.checkSession().subscribe();

    httpTesting
      .expectOne('/api/auth/me')
      .flush({ id: 'user-1', email: 'me@example.com', picture: 'https://example.com/pic.jpg' });

    expect(service.currentUser()?.['picture']).toBe('https://example.com/pic.jpg');
  });

  it('checkSession clears currentUser on a failed request', () => {
    service.checkSession().subscribe();

    httpTesting.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.currentUser()).toBeNull();
  });

  it('logout clears currentUser', () => {
    service.checkSession().subscribe();
    httpTesting.expectOne('/api/auth/me').flush({ id: 'user-1', email: 'me@example.com' });

    service.logout().subscribe();
    httpTesting.expectOne('/api/auth/logout').flush(null);

    expect(service.currentUser()).toBeNull();
  });
});
