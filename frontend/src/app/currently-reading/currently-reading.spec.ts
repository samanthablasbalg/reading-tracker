import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CurrentlyReadingComponent } from './currently-reading';
import { EngagementService } from '../engagement.service';
import { ProgressLogSheetComponent } from '../progress-log-sheet/progress-log-sheet';

const mockEngagement = {
  id: 'eng-1',
  book: {
    id: 'book-1',
    title: 'Dune',
    authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
    default_page_count: null as number | null,
  },
  cover_url: null as string | null,
  status: 'reading',
  started_on: '2026-06-01',
  finished_on: null,
  resume_from_page: 0,
  completion_pct: null as number | null,
};

function findButton(nativeEl: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(nativeEl.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().includes(text),
  ) as HTMLButtonElement;
}

describe('CurrentlyReadingComponent', () => {
  let httpTesting: HttpTestingController;
  let engagementService: EngagementService;
  let mockBottomSheet: { open: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockBreakpointObserver: { isMatched: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBottomSheet = { open: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockBreakpointObserver = { isMatched: vi.fn().mockReturnValue(false) };

    await TestBed.configureTestingModule({
      imports: [CurrentlyReadingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatBottomSheet, useValue: mockBottomSheet },
        { provide: MatDialog, useValue: mockDialog },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    engagementService = TestBed.inject(EngagementService);
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

  it('renders title, authors, and start date for each engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
    expect(item.textContent).toContain('Started');
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([
      {
        ...mockEngagement,
        book: {
          id: 'book-1',
          title: 'Good Omens',
          authors: [
            { id: 'auth-1', name: 'Terry Pratchett' },
            { id: 'auth-2', name: 'Neil Gaiman' },
          ],
          default_page_count: null as number | null,
        },
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
    );
  });

  it('omits the resume-from line when resume_from_page is 0', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain(
      'Resuming from',
    );
  });

  it('renders the resume-from page', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([{ ...mockEngagement, resume_from_page: 42 }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Resuming from p.42',
    );
  });

  it('renders completion % when non-null', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList([{ ...mockEngagement, completion_pct: 47 }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      '47% complete',
    );
  });

  it('omits completion % when null', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain(
      '% complete',
    );
  });

  it('renders a Mark as finished button per engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Mark as finished')).toBeTruthy();
  });

  it('renders a Log progress button per engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    expect(findButton(fixture.nativeElement, 'Log progress')).toBeTruthy();
  });

  it('disables the mark-finished button and shows Marking… while the request is in flight', () => {
    vi.spyOn(engagementService, 'reloadEngagements').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mark as finished').click();
    fixture.detectChanges();

    const button = findButton(fixture.nativeElement, 'Marking…');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Marking…');

    httpTesting.expectOne((req) => req.method === 'PATCH').flush({});
  });

  it('calls reloadEngagements after a successful mark-finished', () => {
    const spy = vi
      .spyOn(engagementService, 'reloadEngagements')
      .mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mark as finished').click();
    httpTesting.expectOne((req) => req.method === 'PATCH').flush({});
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('shows Error on the mark-finished button when the request fails', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    findButton(fixture.nativeElement, 'Mark as finished').click();
    httpTesting.expectOne((req) => req.method === 'PATCH').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[aria-label^="Mark"]').textContent).toContain(
      'Error',
    );
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
          resume_from_page: 42,
          default_page_count: 412,
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
          resume_from_page: 42,
          default_page_count: 412,
        },
      }),
    );
  });
});
