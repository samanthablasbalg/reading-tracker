import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { of } from 'rxjs';
import { AuthService } from '../auth.service';
import { NavShellComponent } from './nav-shell';

function labels(links: NodeListOf<Element>): (string | null | undefined)[] {
  return Array.from(links).map((a) => a.textContent?.trim());
}

function openAccountMenu(fixture: { nativeElement: HTMLElement; detectChanges: () => void }): void {
  const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
    'button[aria-label="Account menu"]',
  )!;
  trigger.click();
  fixture.detectChanges();
}

// The bar's own toggle button relabels itself ("Search books" <-> "Submit search" once open),
// so match either state rather than assuming which one is currently showing.
function openSearchMenu(fixture: { nativeElement: HTMLElement; detectChanges: () => void }): void {
  const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
    'button[aria-label="Search books"], button[aria-label="Submit search"]',
  )!;
  trigger.click();
  fixture.detectChanges();
}

// The <input> is always in the DOM (clipped to 0 width when collapsed, for the width
// transition to animate) - open/closed is reflected by the toggle button's aria-label instead.
function isSearchOpen(fixture: { nativeElement: HTMLElement }): boolean {
  return !!fixture.nativeElement.querySelector('button[aria-label="Submit search"]');
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
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
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

    const navs = fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"]');
    expect(navs.length).toBe(1);
    // The bottom bar is pinned via `sticky`; the sidebar isn't - a real, load-bearing
    // class (not a test-only marker), so this also proves it's the sidebar that rendered.
    expect(navs[0].classList.contains('sticky')).toBe(false);
    expect(labels(navs[0].querySelectorAll('a'))).toEqual([
      'Home',
      'Library',
      'Insights',
      'Challenges',
    ]);
  });

  it('renders a bottom bar with all four destinations, in order, on mobile', () => {
    configure(true);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    const navs = fixture.nativeElement.querySelectorAll('nav[aria-label="Primary"]');
    expect(navs.length).toBe(1);
    expect(navs[0].classList.contains('sticky')).toBe(true);
    expect(labels(navs[0].querySelectorAll('a'))).toEqual([
      'Home',
      'Library',
      'Insights',
      'Challenges',
    ]);
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
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
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

    const accountButton = fixture.nativeElement.querySelector('button[aria-label="Account menu"]')!;
    // mat-icon-button doesn't wrap projected content in a label element - it sits as a
    // direct child alongside Material's own ripple/focus/touch-target spans, which are
    // always empty, so the one span with real text is ours.
    const spans = Array.from(accountButton.querySelectorAll(':scope > span')) as HTMLElement[];
    expect(spans.find((s) => s.textContent?.trim())?.textContent?.trim()).toBe('M');
    expect(accountButton.querySelector('img')).toBeNull();
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

    const accountButton = fixture.nativeElement.querySelector('button[aria-label="Account menu"]')!;
    expect((accountButton.querySelector('img') as HTMLImageElement).src).toBe(
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

    const logoutButton = Array.from(document.querySelectorAll('button[mat-menu-item]')).find((b) =>
      b.textContent?.includes('Log out'),
    )!;
    expect(logoutButton.previousElementSibling?.textContent).toContain('me@example.com');
  });

  it('opens the search panel inline in the header on desktop, and running a search keeps it open', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);
    expect(isSearchOpen(fixture)).toBe(true);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.click();
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([]);
    fixture.detectChanges();

    expect(isSearchOpen(fixture)).toBe(true);
  });

  it('clicking the search icon again closes the inline search', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);
    expect(isSearchOpen(fixture)).toBe(true);

    openSearchMenu(fixture);
    expect(isSearchOpen(fixture)).toBe(false);
  });

  it('clicking outside the search container closes it', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);
    expect(isSearchOpen(fixture)).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(isSearchOpen(fixture)).toBe(false);
  });

  it('clicking inside the search results does not close it', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(isSearchOpen(fixture)).toBe(true);
  });

  it('pressing Escape closes the inline search and returns focus to the trigger', () => {
    configure(false);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Submit search"]',
    );
    expect(isSearchOpen(fixture)).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(isSearchOpen(fixture)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('opens a full-screen dialog for search on mobile', () => {
    configure(true);
    const fixture = TestBed.createComponent(NavShellComponent);
    fixture.detectChanges();

    openSearchMenu(fixture);

    expect(document.querySelector('input')).not.toBeNull();
    expect(document.querySelector('.search-dialog-fullscreen')).not.toBeNull();
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
