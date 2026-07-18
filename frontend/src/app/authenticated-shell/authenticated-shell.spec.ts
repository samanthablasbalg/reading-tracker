import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { AuthenticatedShellComponent } from './authenticated-shell';

describe('AuthenticatedShellComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuthenticatedShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('wraps the routed content in the nav shell', () => {
    const fixture = TestBed.createComponent(AuthenticatedShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-nav-shell')).not.toBeNull();
  });
});
