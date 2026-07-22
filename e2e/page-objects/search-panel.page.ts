import { Locator, Page } from '@playwright/test';

const STUBBED_TITLE = 'Piranesi';
const STUBBED_GOOGLE_BOOKS_ID = 'e2e-piranesi';
const STUBBED_BOOK_ID = '00000000-0000-0000-0000-000000000001';

export class SearchPanelPage {
  readonly searchInput: Locator;
  readonly searchError: Locator;
  /** The fixed title `stubImportFlow` makes searchable. */
  readonly stubbedTitle = STUBBED_TITLE;

  /** @param page - The Playwright page to drive the global search bar through. */
  constructor(public readonly page: Page) {
    this.searchInput = page.getByRole('textbox', { name: 'Search books' });
    this.searchError = page.getByRole('alert');
  }

  /**
   * Opens the search bar: the collapsed icon on desktop, or the full-screen
   * dialog on mobile. Both expose the same "Search books" trigger and the
   * same accessible name on the resulting input, so no viewport branching is
   * needed here or in `searchFor`.
   */
  async openSearchBar(): Promise<void> {
    await this.page.getByRole('button', { name: 'Search books' }).click();
  }

  /**
   * Opens the bar, types the query, and submits it.
   * @param query - The text to search for.
   */
  async searchFor(query: string): Promise<void> {
    await this.openSearchBar();
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  /**
   * Locates the "Import" button for a not-yet-imported search result.
   * @param title - The result's title, as shown in the search results.
   * @returns The Import button locator for that result.
   */
  getImportButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Import ${title}`, exact: true });
  }

  /**
   * Locates the "Add" button for a search result already in the catalog.
   * @param title - The result's title, as shown in the search results.
   * @returns The Add button locator for that result.
   */
  getAddButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Add ${title} to your library`, exact: true });
  }

  /**
   * Locates a search result row by title, to assert its state label
   * (e.g. "Finished") without matching identically-labeled rows elsewhere.
   * @param title - The result's title, as shown in the search results.
   * @returns The result row locator for that title.
   */
  getResultRow(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  /**
   * Imports a not-yet-imported search result.
   * @param title - The result's title, as shown in the search results.
   */
  async importBook(title: string): Promise<void> {
    await this.getImportButton(title).click();
  }

  /**
   * Adds a catalog search result to the library.
   * @param title - The result's title, as shown in the search results.
   */
  async addBook(title: string): Promise<void> {
    await this.getAddButton(title).click();
  }

  /**
   * Stubs the search+import chain for a fixed candidate (`stubbedTitle`):
   * not_in_app until import happens, then in_catalog. Importing always calls
   * live Google Books server-side to fetch the full volume - there's no way
   * to fake that from the browser - so stubbing both calls here is the only
   * way to make the Import flow deterministic in e2e. Mirrors
   * CatalogPage.stubBookImportFlow for the new global search bar.
   */
  async stubImportFlow(): Promise<void> {
    let imported = false;
    await this.page.route('**/api/books/search**', (route) =>
      route.fulfill({
        json: [
          {
            state: imported ? 'in_catalog' : 'not_in_app',
            book_id: imported ? STUBBED_BOOK_ID : null,
            google_books_id: STUBBED_GOOGLE_BOOKS_ID,
            title: STUBBED_TITLE,
            authors: ['Susanna Clarke'],
            published_date: '2020-09-15',
            page_count: 245,
            categories: ['Fiction'],
            cover_url: null,
            language: 'en',
            status: null,
          },
        ],
      })
    );
    await this.page.route('**/api/books/import', (route) => {
      imported = true;
      return route.fulfill({
        json: {
          id: STUBBED_BOOK_ID,
          title: STUBBED_TITLE,
          authors: [{ id: '00000000-0000-0000-0000-000000000002', name: 'Susanna Clarke' }],
          google_books_id: STUBBED_GOOGLE_BOOKS_ID,
          default_cover_url: null,
          default_page_count: 245,
          default_audio_minutes: null,
          original_language: 'en',
          genres: ['Fiction'],
          publication_date: '2020-09-15',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      });
    });
  }

  /** Stubs the search endpoint to fail with a 500, exercising the error path. */
  async stubSearchFailure(): Promise<void> {
    await this.page.route('**/api/books/search**', (route) => route.fulfill({ status: 500 }));
  }
}
