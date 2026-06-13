import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BookSearchComponent } from './book-search';
import { BookService } from '../book.service';

describe('BookSearchComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookSearchComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('does not send a search request when the query is blank', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-flat-button]').click();
    fixture.detectChanges();

    httpTesting.expectNone((req) => req.url.includes('/api/books/search'));
  });

  it('shows an error message when the search request fails', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Search failed');
  });

  it('calls the import endpoint with the correct id when Add is clicked', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .flush([
        {
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965',
          page_count: null,
          categories: [],
          cover_url: null,
          language: null,
        },
      ]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();

    const importReq = httpTesting.expectOne('/api/books/import');
    expect(importReq.request.body).toEqual({ google_books_id: 'gbid-dune' });
    importReq.flush({});
  });

  it('calls reloadBooks after a successful import', () => {
    const bookService = TestBed.inject(BookService);
    vi.spyOn(bookService, 'reloadBooks');

    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .flush([
        {
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965',
          page_count: null,
          categories: [],
          cover_url: null,
          language: null,
        },
      ]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/books/import').flush({});
    fixture.detectChanges();

    expect(bookService.reloadBooks).toHaveBeenCalledOnce();
  });

  it('shows a per-row error message when an import fails', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .flush([
        {
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965',
          page_count: null,
          categories: [],
          cover_url: null,
          language: null,
        },
      ]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/books/import').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not import this book');
  });

  it('shows Added and disables the button after a successful import', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .flush([
        {
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965',
          page_count: null,
          categories: [],
          cover_url: null,
          language: null,
        },
      ]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/books/import').flush({});
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('button[mat-stroked-button]');
    expect(addButton.textContent).toContain('Added');
    expect(addButton.disabled).toBe(true);
  });

  it('does not fire a second search request when Enter is pressed while a search is in flight', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));

    // First Enter — starts the search
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    // Second Enter — should be ignored while search is in flight
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    // Only one request should have been made
    const requests = httpTesting.match((req) => req.url.includes('/api/books/search'));
    expect(requests).toHaveLength(1);
    requests[0].flush([]);
  });

  it('clears a stale import error when a new search is run', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    const searchButton = fixture.nativeElement.querySelector('button[mat-flat-button]');
    const candidate = {
      google_books_id: 'gbid-dune',
      title: 'Dune',
      authors: ['Frank Herbert'],
      published_date: '1965',
      page_count: null,
      categories: [],
      cover_url: null,
      language: null,
    };

    // First search — import fails
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    searchButton.click();
    httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([candidate]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();
    httpTesting.expectOne('/api/books/import').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not import this book');

    // Second search — same candidate appears, error should be gone
    input.value = 'Dune again';
    input.dispatchEvent(new Event('input'));
    searchButton.click();
    httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([candidate]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Could not import this book');
  });

  it('renders candidates after a successful search', () => {
    const fixture = TestBed.createComponent(BookSearchComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input');
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[mat-flat-button]').click();

    httpTesting
      .expectOne((req) => req.url === '/api/books/search' && req.params.get('q') === 'Dune')
      .flush([
        {
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965-08-01',
          page_count: 412,
          categories: [],
          cover_url: null,
          language: 'en',
        },
      ]);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Dune');
    expect(rows[0].textContent).toContain('Frank Herbert');
    expect(rows[0].textContent).toContain('1965');
  });
});
