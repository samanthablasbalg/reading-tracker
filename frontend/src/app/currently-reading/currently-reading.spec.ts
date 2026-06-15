import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CurrentlyReadingComponent } from './currently-reading';
import { EngagementService } from '../engagement.service';

const mockEngagement = {
  id: 'eng-1',
  book: { id: 'book-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrentlyReadingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
        },
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
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

  it('disables the log-progress button and shows Logging… while the request is in flight', () => {
    vi.spyOn(engagementService, 'reloadEngagements').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="number"]');
    input.value = '150';
    input.dispatchEvent(new Event('input'));

    findButton(fixture.nativeElement, 'Log progress').click();
    fixture.detectChanges();

    const button = findButton(fixture.nativeElement, 'Logging…');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Logging…');

    httpTesting
      .expectOne((req) => req.method === 'POST' && req.url.includes('progress-logs'))
      .flush({});
  });

  it('calls reloadEngagements after a successful log-progress', () => {
    const spy = vi
      .spyOn(engagementService, 'reloadEngagements')
      .mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="number"]');
    input.value = '150';
    input.dispatchEvent(new Event('input'));

    findButton(fixture.nativeElement, 'Log progress').click();
    httpTesting
      .expectOne((req) => req.method === 'POST' && req.url.includes('progress-logs'))
      .flush({});
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('shows Error on the log-progress button when the request fails', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="number"]');
    input.value = '150';
    input.dispatchEvent(new Event('input'));

    findButton(fixture.nativeElement, 'Log progress').click();
    httpTesting
      .expectOne((req) => req.method === 'POST' && req.url.includes('progress-logs'))
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('button[aria-label^="Log progress"]').textContent,
    ).toContain('Error');
  });
});
