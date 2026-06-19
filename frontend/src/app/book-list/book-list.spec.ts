import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BookListComponent } from './book-list';
import { EngagementService } from '../engagement.service';

const mockBook = {
  id: 'book-1',
  title: 'Dune',
  authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
};

describe('BookListComponent', () => {
  let httpTesting: HttpTestingController;
  let engagementService: EngagementService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    engagementService = TestBed.inject(EngagementService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders no items when the API returns an empty list', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items).toHaveLength(0);
  });

  it('renders title and author for each book', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    const mockBooks = [
      { id: 'id-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
      { id: 'id-2', title: 'Foundation', authors: [{ id: 'auth-2', name: 'Isaac Asimov' }] },
    ];
    httpTesting.expectOne('/api/books').flush(mockBooks);

    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items).toHaveLength(mockBooks.length);
    expect(items[0].textContent).toContain(mockBooks[0].title);
    expect(items[0].textContent).toContain(mockBooks[0].authors[0].name);
    expect(items[1].textContent).toContain(mockBooks[1].title);
    expect(items[1].textContent).toContain(mockBooks[1].authors[0].name);
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([
      {
        id: 'id-1',
        title: 'Good Omens',
        authors: [
          { id: 'auth-1', name: 'Terry Pratchett' },
          { id: 'auth-2', name: 'Neil Gaiman' },
        ],
      },
    ]);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Terry Pratchett, Neil Gaiman');
  });

  it('renders a Mark as reading button per book', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button[mat-stroked-button]');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Mark as reading');
  });

  it('sends POST /api/engagements with the correct book_id', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();

    const req = httpTesting.expectOne('/api/engagements');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ book_id: 'book-1' });
    req.flush({});
  });

  it('disables the button and shows Marking… while the request is in flight', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[mat-stroked-button]');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Marking…');

    httpTesting.expectOne('/api/engagements').flush({});
  });

  it('calls reloadEngagements after a successful mark-reading', () => {
    vi.spyOn(engagementService, 'reloadEngagements');

    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/engagements').flush({});
    fixture.detectChanges();

    expect(engagementService.reloadEngagements).toHaveBeenCalledOnce();
  });

  it('shows Already reading on a 409 response', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/engagements').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[mat-stroked-button]').textContent).toContain(
      'Already reading',
    );
  });

  it('shows Error on a non-409 failure', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting
      .expectOne('/api/engagements')
      .flush({}, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[mat-stroked-button]').textContent).toContain(
      'Error',
    );
  });
});
