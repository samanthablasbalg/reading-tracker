import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CurrentlyReadingComponent } from './currently-reading';
import { ProgressLogSheetComponent } from '../progress-log-sheet/progress-log-sheet';

const mockEngagement = {
  id: 'eng-1',
  book: {
    id: 'book-1',
    title: 'Dune',
    authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
    default_page_count: null as number | null,
    default_audio_minutes: 0,
  },
  formats: ['print'] as string[],
  cover_url: null as string | null,
  status: 'reading',
  started_on: '2026-06-01',
  finished_on: null,
  resume_from_page: 0,
  resume_from_minute: 0,
  completion_pct: null as number | null,
};

function findButton(nativeEl: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(nativeEl.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().includes(text),
  ) as HTMLButtonElement;
}

describe('CurrentlyReadingComponent', () => {
  let httpTesting: HttpTestingController;
  let mockBottomSheet: { open: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockBreakpointObserver: {
    isMatched: ReturnType<typeof vi.fn>;
    observe: ReturnType<typeof vi.fn>;
  };

  let bottomSheetAfterDismissed: Subject<void>;
  let mockBottomSheetRef: { dismiss: ReturnType<typeof vi.fn>; afterDismissed: () => unknown };

  beforeEach(async () => {
    bottomSheetAfterDismissed = new Subject<void>();
    mockBottomSheetRef = {
      dismiss: vi.fn(() => bottomSheetAfterDismissed.next()),
      afterDismissed: () => bottomSheetAfterDismissed.asObservable(),
    };
    mockBottomSheet = { open: vi.fn().mockReturnValue(mockBottomSheetRef) };
    mockDialog = { open: vi.fn() };
    mockBreakpointObserver = {
      isMatched: vi.fn().mockReturnValue(false),
      observe: vi.fn().mockReturnValue(of({ matches: true })),
    };

    await TestBed.configureTestingModule({
      imports: [CurrentlyReadingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatBottomSheet, useValue: mockBottomSheet },
        { provide: MatDialog, useValue: mockDialog },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushReadingList(data = [mockEngagement]) {
    httpTesting
      .expectOne((req) => req.url === '/api/engagements' && req.params.get('status') === 'reading')
      .flush(data);
  }

  it('shows empty state when there are no engagements', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No books in progress');
  });

  it('renders title and authors for each engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-card');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([
      {
        ...mockEngagement,
        book: {
          ...mockEngagement.book,
          title: 'Good Omens',
          authors: [
            { id: 'auth-1', name: 'Terry Pratchett' },
            { id: 'auth-2', name: 'Neil Gaiman' },
          ],
        },
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-card').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
    );
  });

  it('renders a cover image when cover_url is set', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([{ ...mockEngagement, cover_url: 'https://example.com/cover.jpg' }]);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('ng-img')).toBeTruthy();
  });

  it('shows no cover image when cover_url is null', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('renders completion % when non-null', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([{ ...mockEngagement, completion_pct: 47 }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-card').textContent).toContain('47%');
  });

  it('omits completion % when null', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-card').textContent).not.toContain('%');
  });

  it('renders a Log progress button per engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Log progress')).toBeTruthy();
  });

  describe('responsive layout', () => {
    it('shows text and bar, hides spinner at wide viewport', () => {
      mockBreakpointObserver.observe.mockReturnValue(of({ matches: true }));

      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList([{ ...mockEngagement, completion_pct: 47 }]);
      fixture.detectChanges();

      expect(mockBreakpointObserver.observe).toHaveBeenCalledWith('(min-width: 781px)');
      expect(mockBreakpointObserver.observe).toHaveBeenCalledWith('(min-width: 600px)');
      expect(fixture.nativeElement.querySelector('.text')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.progress-col')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();
    });

    it('shows text and spinner, hides bar at medium viewport', () => {
      mockBreakpointObserver.observe.mockImplementation((query: string) =>
        of({ matches: query === '(min-width: 600px)' }),
      );

      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList([{ ...mockEngagement, completion_pct: 47 }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.text')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.progress-col')).toBeNull();
      expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeTruthy();
    });

    it('shows text and spinner, hides bar at narrow viewport', () => {
      mockBreakpointObserver.observe.mockReturnValue(of({ matches: false }));

      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList([{ ...mockEngagement, completion_pct: 47 }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.text')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.progress-col')).toBeNull();
      expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeTruthy();
    });

    it('shows no spinner when completion_pct is null', () => {
      mockBreakpointObserver.observe.mockReturnValue(of({ matches: false }));

      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeNull();
    });
  });

  describe('format icon', () => {
    it('renders menu_book for a print engagement', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);

      flushReadingList([{ ...mockEngagement, formats: ['print'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon).toBeTruthy();
      expect(icon.textContent.trim()).toBe('menu_book');
      expect(icon.getAttribute('aria-label')).toBe('Format: print');
    });

    it('renders tablet_mac for a digital engagement', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);

      flushReadingList([{ ...mockEngagement, formats: ['digital'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('tablet_mac');
      expect(icon.getAttribute('aria-label')).toBe('Format: digital');
    });

    it('renders headphones for an audio engagement', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);

      flushReadingList([{ ...mockEngagement, formats: ['audio'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('headphones');
      expect(icon.getAttribute('aria-label')).toBe('Format: audio');
    });

    it('renders no icon when formats is empty', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);

      flushReadingList([{ ...mockEngagement, formats: [] }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-icon[aria-label^="Format:"]')).toBeNull();
    });
  });

  it('opens a bottom sheet when Log progress is clicked on a narrow viewport', () => {
    mockBreakpointObserver.isMatched.mockReturnValue(true);
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Log progress').click();

    expect(mockBottomSheet.open).toHaveBeenCalledOnce();
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('opens a dialog when Log progress is clicked on a wide viewport', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Log progress').click();

    expect(mockDialog.open).toHaveBeenCalledOnce();
    expect(mockBottomSheet.open).not.toHaveBeenCalled();
  });

  describe('logSheetOpen (read by logSheetOpenGuard for the back button)', () => {
    it('is set once the bottom sheet opens and cleared once it is dismissed', () => {
      mockBreakpointObserver.isMatched.mockReturnValue(true);
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      expect(fixture.componentInstance.logSheetOpen()).toBe(false);

      findButton(fixture.nativeElement, 'Log progress').click();
      expect(fixture.componentInstance.logSheetOpen()).toBe(true);

      bottomSheetAfterDismissed.next();
      expect(fixture.componentInstance.logSheetOpen()).toBe(false);
    });

    it('stays false for the desktop dialog, which the back-button guard does not cover', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      findButton(fixture.nativeElement, 'Log progress').click();

      expect(fixture.componentInstance.logSheetOpen()).toBe(false);
    });

    it('closeLogSheet dismisses the open bottom sheet', () => {
      mockBreakpointObserver.isMatched.mockReturnValue(true);
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      findButton(fixture.nativeElement, 'Log progress').click();
      fixture.componentInstance.closeLogSheet();

      expect(mockBottomSheetRef.dismiss).toHaveBeenCalledOnce();
    });

    it('closeLogSheet is a no-op when nothing is open', () => {
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      expect(() => fixture.componentInstance.closeLogSheet()).not.toThrow();
      expect(mockBottomSheetRef.dismiss).not.toHaveBeenCalled();
    });
  });

  it('passes cover, title, resume page, and page count to the dialog on wide viewport', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList([
      {
        ...mockEngagement,
        resume_from_page: 42,
        cover_url: 'https://example.com/cover.jpg',
        book: { ...mockEngagement.book, default_page_count: 412 },
      },
    ]);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Log progress').click();

    expect(mockDialog.open).toHaveBeenCalledWith(
      ProgressLogSheetComponent,
      expect.objectContaining({
        data: {
          engagementId: 'eng-1',
          title: 'Dune',
          cover_url: 'https://example.com/cover.jpg',
          formats: ['print'],
          resume_from_page: 42,
          resume_from_minute: 0,
          default_page_count: 412,
          default_audio_minutes: 0,
        },
      }),
    );
  });

  it('passes cover, title, resume page, and page count to the bottom sheet on narrow viewport', () => {
    mockBreakpointObserver.isMatched.mockReturnValue(true);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList([
      {
        ...mockEngagement,
        resume_from_page: 42,
        cover_url: 'https://example.com/cover.jpg',
        book: { ...mockEngagement.book, default_page_count: 412 },
      },
    ]);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Log progress').click();

    expect(mockBottomSheet.open).toHaveBeenCalledWith(
      ProgressLogSheetComponent,
      expect.objectContaining({
        data: {
          engagementId: 'eng-1',
          title: 'Dune',
          cover_url: 'https://example.com/cover.jpg',
          formats: ['print'],
          resume_from_page: 42,
          resume_from_minute: 0,
          default_page_count: 412,
          default_audio_minutes: 0,
        },
      }),
    );
  });

  describe('engagement deletion', () => {
    it('declining the confirm dialog sends no request', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      httpTesting.expectNone('/api/engagements/eng-1');
    });

    it('confirming calls DELETE then reloads the engagement lists', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(CurrentlyReadingComponent);
      flushReadingList();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      flushReadingList([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No books in progress');
    });
  });
});
