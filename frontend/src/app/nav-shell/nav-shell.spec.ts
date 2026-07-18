import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { AuthService } from '../auth.service';
import { NavShellComponent } from './nav-shell';

function labels(links: NodeListOf<Element>): (string | null | undefined)[] {
  return Array.from(links).map((a) => a.querySelector('.nav-label')?.textContent?.trim());
}

function openAccountMenu(fixture: { nativeElement: HTMLElement; detectChanges: () => void }): void {
  const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
    'button[aria-label="Account menu"]',
  )!;
  trigger.click();
  fixture.detectChanges();
}

describe('NavShellComponent', () => {
  let httpTesting: HttpTestingController;
  let mockBreakpointObserver: { observe: ReturnType<typeof vi.fn> };

  function configure(isMobile: boolean): void {
    mockBreakpointObserver = { observe: vi.fn().mockReturnValue(of({ matches: isMobile })) };

    TestBed.configureTestingModule({
      imports: [NavShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders a sidebar with all four destinations, in order, on desktop', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav.sidebar a');
    expect(labels(links)).toEqual(['Home', 'Library', 'Insights', 'Challenges']);
    expect(fixture.nativeElement.querySelector('nav.bottom-bar')).toBeNull();
  });

  it('renders a bottom bar with all four destinations, in order, on mobile', () => {
    configure(true);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav.bottom-bar a');
    expect(labels(links)).toEqual(['Home', 'Library', 'Insights', 'Challenges']);
    expect(fixture.nativeElement.querySelector('nav.sidebar')).toBeNull();
  });

  it('projects the routed content into the shell', () => {
    mockBreakpointObserver = { observe: vi.fn().mockReturnValue(of({ matches: false })) };

    @Component({
      selector: 'app-host',
      imports: [NavShellComponent],
      template: `<app-nav-shell><p class="projected">hello</p></app-nav-shell>`,
    })
    class HostComponent {}

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.projected').textContent).toBe('hello');
  });

  it('falls back to an initial in a branded circle when the user has no picture', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    TestBed.inject(AuthService).checkSession().subscribe();
    httpTesting.expectOne('/api/auth/me').flush({ id: 'user-1', email: 'me@example.com' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.avatar-fallback')!.textContent!.trim()).toBe('M');
    expect(fixture.nativeElement.querySelector('.avatar-img')).toBeNull();
  });

  it('shows the Google picture when the user has one', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    TestBed.inject(AuthService).checkSession().subscribe();
    httpTesting.expectOne('/api/auth/me').flush({
      id: 'user-1',
      email: 'me@example.com',
      picture: 'https://example.com/pic.jpg',
    });
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.avatar-img') as HTMLImageElement).src).toBe(
      'https://example.com/pic.jpg',
    );
  });

  it('shows the signed-in email in the account menu', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    TestBed.inject(AuthService).checkSession().subscribe();
    httpTesting.expectOne('/api/auth/me').flush({ id: 'user-1', email: 'me@example.com' });
    fixture.detectChanges();

    openAccountMenu(fixture);

    expect(document.querySelector('.menu-header')!.textContent).toContain('me@example.com');
  });

  it('logs out and navigates to / when "Log out" is clicked', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    openAccountMenu(fixture);

    const logoutButton = Array.from(document.querySelectorAll('button[mat-menu-item]')).find((b) =>
      b.textContent?.includes('Log out'),
    ) as HTMLButtonElement;
    logoutButton.click();
    httpTesting.expectOne('/api/auth/logout').flush(null);

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
