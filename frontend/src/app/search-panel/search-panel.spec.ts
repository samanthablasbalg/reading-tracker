import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SearchPanelComponent } from './search-panel';

describe('SearchPanelComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function search(fixture: { nativeElement: HTMLElement; detectChanges: () => void }, q: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input')!;
    input.value = q;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  }

  it('does not send a search request when the query is blank', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    httpTesting.expectNone((req) => req.url.includes('/api/books/search'));
  });

  it('shows an error message when the search request fails', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    search(fixture, 'Dune');

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Search failed');
  });

  it('shows "No results." when a search comes back empty', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    search(fixture, 'Dune');

    httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No results.');
  });

  it('renders one row per result after a successful search', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    search(fixture, 'Dune');

    httpTesting
      .expectOne((req) => req.url === '/api/books/search' && req.params.get('q') === 'Dune')
      .flush([
        {
          state: 'not_in_app',
          book_id: null,
          google_books_id: 'gbid-dune',
          title: 'Dune',
          authors: ['Frank Herbert'],
          published_date: '1965',
          page_count: 412,
          categories: [],
          cover_url: null,
          language: 'en',
          status: null,
        },
      ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-search-result-row').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Dune');
  });

  it('does not fire a second search request when Enter is pressed while a search is in flight', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    search(fixture, 'Dune');
    search(fixture, 'Dune');

    const requests = httpTesting.match((req) => req.url.includes('/api/books/search'));
    expect(requests).toHaveLength(1);
    requests[0].flush([]);
  });

  it('clicking the submit button also triggers a search', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input')!;
    input.value = 'Dune';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('button[aria-label="Submit search"]').click();
    fixture.detectChanges();

    httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([]);
  });
});
