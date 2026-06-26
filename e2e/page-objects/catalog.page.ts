import { Locator, Page } from '@playwright/test';
import { FormatPickSheetPage, PickableFormat } from './format-pick-sheet.page';

// A search result as returned by GET /api/books/search.
export interface SearchCandidate {
  google_books_id: string;
  title: string;
  authors: string[];
  published_date: string | null;
  page_count: number | null;
  categories: string[];
  cover_url: string | null;
  language: string | null;
}

// A library book as returned by GET /api/books — only the fields the list renders.
export interface LibraryBook {
  id: string;
  title: string;
  authors: { id: string; name: string }[];
}

export class CatalogPage {
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly searchError: Locator;

  /** @param page - The Playwright page to drive the catalog through. */
  constructor(public readonly page: Page) {
    this.searchInput = page.getByRole('textbox', { name: 'Search books' });
    this.searchButton = page.getByRole('button', { name: 'Search' });
    this.searchError = page.getByRole('alert');
  }

  /** Navigates to the catalog page. */
  async goto(): Promise<void> {
    await this.page.goto('/catalog');
  }

  /**
   * Types a query into the search box and submits the search.
   * @param query - The text to search for.
   */
  async searchFor(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  /**
   * Locates the "Add" button for a given search-result candidate.
   * @param title - The candidate's title, as shown in the results.
   * @returns The Add button locator for that candidate.
   */
  getAddButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Add ${title}`, exact: true });
  }

  /**
   * Adds a search-result candidate to the library.
   * @param title - The candidate's title, as shown in the results.
   */
  async addBook(title: string): Promise<void> {
    await this.getAddButton(title).click();
  }

  /**
   * Locates the "Mark as reading" button for a book in the library list.
   * @param title - The library book's title.
   * @returns The mark-as-reading button locator for that book.
   */
  getMarkAsReadingButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Mark ${title} as reading` });
  }

  /**
   * Marks a library book as currently reading in the given format.
   * Clicks the button to open the format picker, then picks the format.
   * @param title - The library book's title.
   * @param format - The format to start reading in (defaults to Print).
   * @param audioLengthHhmm - Required for Audio when the book has no stored length.
   */
  async markAsReading(
    title: string,
    format: PickableFormat = 'Print',
    audioLengthHhmm?: string,
  ): Promise<void> {
    await this.getMarkAsReadingButton(title).click();
    await new FormatPickSheetPage(this.page).pick(title, format, audioLengthHhmm);
  }

  /**
   * Stubs the whole add-a-book chain. Importing re-fetches from live Google
   * Books, so the flow can't run for real: this fulfils the search result, the
   * import response, and the library list (empty until the book is imported,
   * then containing it) to make the round-trip deterministic.
   * @param candidate - The search result the stubbed search returns.
   * @param book - The library book the import yields and the list then contains.
   */
  async stubBookImportFlow(candidate: SearchCandidate, book: LibraryBook): Promise<void> {
    let imported = false;
    await this.page.route('**/api/books/search**', (route) => route.fulfill({ json: [candidate] }));
    await this.page.route('**/api/books/import', (route) => {
      imported = true;
      return route.fulfill({ json: book });
    });
    await this.page.route('**/api/books', (route) =>
      route.fulfill({ json: imported ? [book] : [] })
    );
  }

  /** Stubs the search endpoint to fail with a 500, exercising the error path. */
  async stubSearchFailure(): Promise<void> {
    await this.page.route('**/api/books/search**', (route) => route.fulfill({ status: 500 }));
  }
}
