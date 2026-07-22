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

    // Scoped to the info block, not the whole row - mat-stroked-button's own internals
    // (ripple/focus-indicator) render their own <span>s that aren't the status tag.
    expect(fixture.nativeElement.querySelector('.min-w-0 span')).toBeNull();
  });

  it('renders no img element when there is no cover', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ cover_url: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('shows an Import button for a not_in_app result and emits importRequested when clicked', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'not_in_app' }));
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.importRequested.subscribe(() => (emitted = true));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Import Dune"]',
    );
    expect(button).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label*="Add"]')).toBeNull();

    button.click();
    expect(emitted).toBe(true);
  });

  it('disables the Import button while importing', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'not_in_app' }));
    fixture.componentRef.setInput('importing', true);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Import Dune"]',
    );
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Importing…');
  });

  it('shows an Add button for an in_catalog result and emits addRequested when clicked', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput('result', result({ state: 'in_catalog', book_id: 'book-1' }));
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.addRequested.subscribe(() => (emitted = true));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Add Dune to your library"]',
    );
    expect(button).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label^="Import"]')).toBeNull();

    button.click();
    expect(emitted).toBe(true);
  });

  it('shows no action button for an in_library result', () => {
    const fixture = TestBed.createComponent(SearchResultRowComponent);
    fixture.componentRef.setInput(
      'result',
      result({ state: 'in_library', book_id: 'book-1', status: 'reading' }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
