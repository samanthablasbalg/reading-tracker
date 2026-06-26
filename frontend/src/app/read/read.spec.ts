import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ReadComponent } from './read';
import { ReviewSheetComponent } from '../review-sheet/review-sheet';

const mockEngagement = {
  id: 'eng-1',
  book: { id: 'book-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
  formats: [] as string[],
  cover_url: null as string | null,
  status: 'finished',
  started_on: '2026-05-01',
  finished_on: '2026-06-01' as string | null,
  review: null as { rating: string | null; body: string | null } | null,
};

function findButton(nativeEl: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(nativeEl.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().includes(text),
  ) as HTMLButtonElement;
}

describe('ReadComponent', () => {
  let httpTesting: HttpTestingController;
  let mockBottomSheet: { open: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockBreakpointObserver: { isMatched: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBottomSheet = { open: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockBreakpointObserver = { isMatched: vi.fn().mockReturnValue(false) };

    await TestBed.configureTestingModule({
      imports: [ReadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

  function flushFinishedList(data = [mockEngagement]) {
    httpTesting
      .expectOne((req) => req.url === '/api/engagements' && req.params.get('status') === 'finished')
      .flush(data);
  }

  it('shows empty state when there are no finished books', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No finished books yet');
  });

  it('renders title, authors, and finish date for each engagement', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
    expect(item.textContent).toContain('Finished');
    expect(item.textContent).toContain('Jun 1, 2026');
  });

  it('omits the finished line when finished_on is null', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([{ ...mockEngagement, finished_on: null }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain(
      'Finished',
    );
  });

  describe('format icon', () => {
    it('renders menu_book for a print engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['print'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon).toBeTruthy();
      expect(icon.textContent.trim()).toBe('menu_book');
      expect(icon.getAttribute('aria-label')).toBe('Format: print');
    });

    it('renders tablet_mac for a digital engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['digital'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('tablet_mac');
      expect(icon.getAttribute('aria-label')).toBe('Format: digital');
    });

    it('renders headphones for an audio engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['audio'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('headphones');
      expect(icon.getAttribute('aria-label')).toBe('Format: audio');
    });

    it('renders no icon when formats is empty', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: [] }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-icon')).toBeNull();
    });
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([
      {
        ...mockEngagement,
        book: {
          id: 'book-1',
          title: 'Good Omens',
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

  // --- Review button ---

  it('shows Add review button when there is no review', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList();
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Add review')).toBeTruthy();
  });

  it('shows Edit review button when a review exists', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList([{ ...mockEngagement, review: { rating: '3.75', body: null } }]);
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Edit review')).toBeTruthy();
  });

  // --- Review summary line ---

  it('shows no review line when review is null', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain('★');
  });

  it('shows rating when review has a rating and no body', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList([{ ...mockEngagement, review: { rating: '3.75', body: null } }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain('3.75 ★');
  });

  it('shows body when review has body and no rating', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList([{ ...mockEngagement, review: { rating: null, body: 'Loved it.' } }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain('Loved it.');
    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain('★');
  });

  it('shows rating and body joined by · when both are set', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList([
      { ...mockEngagement, review: { rating: '4.25', body: 'Really enjoyed this.' } },
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('mat-list-item').textContent;
    expect(text).toContain('4.25 ★');
    expect(text).toContain('·');
    expect(text).toContain('Really enjoyed this.');
  });

  // --- Sheet opening ---

  it('opens a dialog when the button is clicked on a wide viewport', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Add review').click();

    expect(mockDialog.open).toHaveBeenCalledOnce();
    expect(mockBottomSheet.open).not.toHaveBeenCalled();
  });

  it('opens a bottom sheet when the button is clicked on a narrow viewport', () => {
    mockBreakpointObserver.isMatched.mockReturnValue(true);
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Add review').click();

    expect(mockBottomSheet.open).toHaveBeenCalledOnce();
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('passes engagement data to the sheet', () => {
    const fixture = TestBed.createComponent(ReadComponent);
    flushFinishedList([
      { ...mockEngagement, cover_url: 'https://example.com/cover.jpg', review: null },
    ]);
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
});
