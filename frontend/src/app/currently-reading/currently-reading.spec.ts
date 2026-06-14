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
};

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

  it('renders a Mark as finished button per engagement', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);

    flushReadingList();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[mat-stroked-button]');
    expect(button.textContent).toContain('Mark as finished');
  });

  it('disables the button and shows Marking… while the request is in flight', () => {
    vi.spyOn(engagementService, 'reloadEngagements').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[mat-stroked-button]');
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

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne((req) => req.method === 'PATCH').flush({});
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('shows Error when the mark-finished request fails', () => {
    const fixture = TestBed.createComponent(CurrentlyReadingComponent);
    flushReadingList();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne((req) => req.method === 'PATCH').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[mat-stroked-button]').textContent).toContain(
      'Error',
    );
  });
});
