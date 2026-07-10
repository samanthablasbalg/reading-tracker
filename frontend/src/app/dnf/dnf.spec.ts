import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DNFComponent } from './dnf';
import { ReviewSheetComponent } from '../review-sheet/review-sheet';

const mockDnf = {
  id: 'eng-1',
  book: {
    id: 'book-1',
    title: 'Dune',
    authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
    default_page_count: null as number | null,
  },
  formats: [] as string[],
  cover_url: null as string | null,
  status: 'dnf',
  started_on: '2026-01-01',
  finished_on: null as string | null,
  abandoned_on: '2026-03-15',
  resume_from_page: 120,
  completion_pct: 43 as number | null,
  review: null as { rating: string | null; body: string | null } | null,
};

function findButton(nativeEl: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(nativeEl.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().includes(text),
  ) as HTMLButtonElement;
}

describe('DNFComponent', () => {
  let httpTesting: HttpTestingController;
  let mockBottomSheet: { open: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockBreakpointObserver: { isMatched: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBottomSheet = { open: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockBreakpointObserver = { isMatched: vi.fn().mockReturnValue(false) };

    await TestBed.configureTestingModule({
      imports: [DNFComponent],
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

  function flushDnfList(data: unknown[] = [mockDnf]) {
    httpTesting
      .expectOne((req) => req.url === '/api/engagements' && req.params.get('status') === 'dnf')
      .flush(data);
  }

  it('shows empty state when there are no DNFed books', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No DNFed books yet');
  });

  it('renders title and authors for each DNFed book', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList([
      {
        ...mockDnf,
        book: {
          ...mockDnf.book,
          authors: [
            { id: 'auth-1', name: 'Terry Pratchett' },
            { id: 'auth-2', name: 'Neil Gaiman' },
          ],
        },
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
    );
  });

  describe('format icon', () => {
    it('renders menu_book for a print engagement', () => {
      const fixture = TestBed.createComponent(DNFComponent);

      flushDnfList([{ ...mockDnf, formats: ['print'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon).toBeTruthy();
      expect(icon.textContent.trim()).toBe('menu_book');
      expect(icon.getAttribute('aria-label')).toBe('Format: print');
    });

    it('renders tablet_mac for a digital engagement', () => {
      const fixture = TestBed.createComponent(DNFComponent);

      flushDnfList([{ ...mockDnf, formats: ['digital'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('tablet_mac');
      expect(icon.getAttribute('aria-label')).toBe('Format: digital');
    });

    it('renders headphones for an audio engagement', () => {
      const fixture = TestBed.createComponent(DNFComponent);

      flushDnfList([{ ...mockDnf, formats: ['audio'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('headphones');
      expect(icon.getAttribute('aria-label')).toBe('Format: audio');
    });

    it('renders no icon when formats is empty', () => {
      const fixture = TestBed.createComponent(DNFComponent);

      flushDnfList([{ ...mockDnf, formats: [] }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-icon[aria-label^="Format:"]')).toBeNull();
    });
  });

  it('renders the give-up date', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList();
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('mat-list-item').textContent;
    expect(text).toContain('Gave up on');
    expect(text).toContain('Mar 15, 2026');
  });

  // --- Review button ---

  it('shows Add review button when there is no review', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList();
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Add review')).toBeTruthy();
  });

  it('shows Edit review button when a review exists', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList([{ ...mockDnf, review: { rating: '3.75', body: null } }]);
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Edit review')).toBeTruthy();
  });

  // --- Review summary line ---

  it('shows no review line when review is null', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain('★');
  });

  it('shows rating when review has a rating and no body', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList([{ ...mockDnf, review: { rating: '3.75', body: null } }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain('3.75 ★');
  });

  it('shows body when review has body and no rating', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList([{ ...mockDnf, review: { rating: null, body: 'Loved it.' } }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('mat-list-item').textContent;
    expect(text).toContain('Loved it.');
    expect(text).not.toContain('★');
  });

  it('shows rating and body joined by · when both are set', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList([{ ...mockDnf, review: { rating: '4.25', body: 'Really enjoyed this.' } }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('mat-list-item').textContent;
    expect(text).toContain('4.25 ★');
    expect(text).toContain('·');
    expect(text).toContain('Really enjoyed this.');
  });

  // --- Sheet opening ---

  it('opens a dialog when the button is clicked on a wide viewport', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Add review').click();

    expect(mockDialog.open).toHaveBeenCalledOnce();
    expect(mockBottomSheet.open).not.toHaveBeenCalled();
  });

  it('opens a bottom sheet when the button is clicked on a narrow viewport', () => {
    mockBreakpointObserver.isMatched.mockReturnValue(true);
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Add review').click();

    expect(mockBottomSheet.open).toHaveBeenCalledOnce();
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('passes engagement data to the sheet', () => {
    const fixture = TestBed.createComponent(DNFComponent);
    flushDnfList([{ ...mockDnf, cover_url: 'https://example.com/cover.jpg', review: null }]);
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Add review').click();

    expect(mockDialog.open).toHaveBeenCalledWith(
      ReviewSheetComponent,
      expect.objectContaining({
        data: {
          engagementId: 'eng-1',
          title: 'Dune',
          cover_url: 'https://example.com/cover.jpg',
          review: null,
        },
      }),
    );
  });

  describe('engagement deletion', () => {
    it('declining the confirm dialog sends no request', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fixture = TestBed.createComponent(DNFComponent);
      flushDnfList();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      httpTesting.expectNone('/api/engagements/eng-1');
    });

    it('confirming calls DELETE then reloads the engagement lists', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(DNFComponent);
      flushDnfList();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      flushDnfList([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No DNFed books yet');
    });
  });
});
