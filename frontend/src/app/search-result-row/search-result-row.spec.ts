import { TestBed } from '@angular/core/testing';
import { SearchResultRowComponent } from './search-result-row';
import { BookSearchResult } from '../book.service';

function result(overrides: Partial<BookSearchResult> = {}): BookSearchResult {
  return {
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
    ...overrides,
  };
}

describe('SearchResultRowComponent', () => {
  it('renders the title and authors', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dune');
    expect(fixture.nativeElement.textContent).toContain('Frank Herbert');
  });

  it('shows the reading status when in the library', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'in_library', status: 'reading' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reading');
  });

  it('shows "In catalog" when in the app but not in the library', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'in_catalog', status: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('In catalog');
  });

  it('shows no status tag for a Google-only result', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'not_in_app', status: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('span')).toBeNull();
  });

  it('renders no img element when there is no cover', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ cover_url: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
