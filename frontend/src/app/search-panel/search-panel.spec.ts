import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { SearchPanelComponent } from './search-panel';
import { BookService } from '../book.service';
import { EngagementStatus } from '../engagement.service';
import { FormatPickSheetComponent } from '../format-pick-sheet/format-pick-sheet';

const notInAppResult = {
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
};

const importedBook = {
  id: 'book-dune',
  title: 'Dune',
  authors: [],
  google_books_id: 'gbid-dune',
  default_cover_url: null,
  default_page_count: 412,
  default_audio_minutes: null,
  original_language: 'en',
  genres: [],
  publication_date: '1965-01-01',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const inCatalogResult = {
  state: 'in_catalog',
  book_id: 'book-dune',
  google_books_id: 'gbid-dune',
  title: 'Dune',
  authors: ['Frank Herbert'],
  published_date: '1965',
  page_count: 412,
  categories: [],
  cover_url: null,
  language: 'en',
  status: null,
};

describe('SearchPanelComponent', () => {
  let httpTesting: HttpTestingController;
  let bottomSheet: MatBottomSheet;
  let dialog: MatDialog;
  let breakpointObserver: BreakpointObserver;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    bottomSheet = TestBed.inject(MatBottomSheet);
    dialog = TestBed.inject(MatDialog);
    breakpointObserver = TestBed.inject(BreakpointObserver);
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

  it('groups results by state, under a heading per non-empty group, in a fixed order', () => {
    const fixture = TestBed.createComponent(SearchPanelComponent);
    fixture.detectChanges();

    search(fixture, 'Chakraborty');

    httpTesting
      .expectOne((req) => req.url.includes('/api/books/search'))
      .flush([
        {
          state: 'not_in_app',
          book_id: null,
          google_books_id: 'gbid-river',
          title: 'The River of Silver',
          authors: ['Shannon Chakraborty'],
          published_date: '2022',
          page_count: 656,
          categories: [],
          cover_url: null,
          language: 'en',
          status: null,
        },
        {
          state: 'in_library',
          book_id: 'book-amina',
          google_books_id: 'gbid-amina',
          title: 'The Adventures of Amina al-Sirafi',
          authors: ['Shannon Chakraborty'],
          published_date: '2023',
          page_count: 496,
          categories: [],
          cover_url: null,
          language: 'en',
          status: 'reading',
        },
      ]);
    fixture.detectChanges();

    const headings = Array.from(
      fixture.nativeElement.querySelectorAll('ul > li') as NodeListOf<HTMLElement>,
    ).map((li) => li.textContent?.trim());
    expect(headings).toEqual([
      expect.stringContaining('In your library'),
      expect.stringContaining('New — from Google Books'),
    ]);
    // "Already in the app" (in_catalog) has no results here, so its heading is absent entirely.
    expect(fixture.nativeElement.textContent).not.toContain('Already in the app');
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

  describe('importing and adding', () => {
    it('imports on click and opens the add sheet, but leaves the row unchanged until the sheet closes', () => {
      vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(false);
      vi.spyOn(dialog, 'open');

      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([notInAppResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Import Dune"]').click();
      fixture.detectChanges();

      httpTesting.expectOne('/api/books/import').flush(importedBook);
      fixture.detectChanges();

      expect(dialog.open).toHaveBeenCalledWith(FormatPickSheetComponent, {
        data: {
          bookId: 'book-dune',
          title: 'Dune',
          cover_url: null,
          default_audio_minutes: null,
          statuses: ['reading', 'finished', 'dnf'],
          cancelLabel: 'No thanks — just import',
        },
      });
      // The row itself hasn't changed - nothing should shift in the list behind an open sheet.
      expect(
        fixture.nativeElement.querySelector('button[aria-label="Import Dune"]'),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('button[aria-label="Add Dune to your library"]'),
      ).toBeNull();
    });

    it('reloads the books list and flips the row to in_library once the sheet closes with a status', () => {
      vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(false);
      const closed$ = new Subject<EngagementStatus | undefined>();
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => closed$.asObservable(),
      } as ReturnType<typeof dialog.open>);

      const bookService = TestBed.inject(BookService);
      bookService.books$.subscribe();
      httpTesting.expectOne('/api/books').flush([]);

      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([notInAppResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Import Dune"]').click();
      httpTesting.expectOne('/api/books/import').flush(importedBook);
      fixture.detectChanges();

      // Sheet is still open (mocked) - nothing reloads or changes yet.
      httpTesting.expectNone('/api/books');
      expect(
        fixture.nativeElement.querySelector('button[aria-label="Import Dune"]'),
      ).not.toBeNull();

      closed$.next('finished');
      fixture.detectChanges();

      httpTesting.expectOne('/api/books').flush([importedBook]);
      expect(fixture.nativeElement.querySelector('button[aria-label="Import Dune"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Finished');
    });

    it('flips the row to in_catalog, not in_library, when the sheet is dismissed without adding', () => {
      vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(false);
      const closed$ = new Subject<EngagementStatus | undefined>();
      vi.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: () => closed$.asObservable(),
      } as ReturnType<typeof dialog.open>);

      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([notInAppResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Import Dune"]').click();
      httpTesting.expectOne('/api/books/import').flush(importedBook);
      fixture.detectChanges();

      closed$.next(undefined);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[aria-label="Import Dune"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('button[aria-label="Add Dune to your library"]'),
      ).not.toBeNull();
    });

    it('disables the Import button while the request is in flight', () => {
      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([notInAppResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Import Dune"]').click();
      fixture.detectChanges();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-label="Import Dune"]',
      );
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Importing…');

      httpTesting.expectOne('/api/books/import').flush(importedBook);
    });

    it('shows an error and re-enables the button when import fails', () => {
      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting.expectOne((req) => req.url.includes('/api/books/search')).flush([notInAppResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Import Dune"]').click();
      httpTesting.expectOne('/api/books/import').error(new ProgressEvent('error'));
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Import failed');
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-label="Import Dune"]',
      );
      expect(button.disabled).toBe(false);
    });

    it('clicking Add on an in_catalog result opens the sheet directly, without importing', () => {
      vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(true);
      vi.spyOn(bottomSheet, 'open');

      const fixture = TestBed.createComponent(SearchPanelComponent);
      fixture.detectChanges();
      search(fixture, 'Dune');
      httpTesting
        .expectOne((req) => req.url.includes('/api/books/search'))
        .flush([inCatalogResult]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Add Dune to your library"]').click();

      httpTesting.expectNone((req) => req.url.includes('/api/books/import'));
      expect(bottomSheet.open).toHaveBeenCalledWith(FormatPickSheetComponent, {
        data: {
          bookId: 'book-dune',
          title: 'Dune',
          cover_url: null,
          default_audio_minutes: null,
          statuses: ['reading', 'finished', 'dnf'],
        },
      });
    });
  });
});
