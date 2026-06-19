import { Locator, Page } from '@playwright/test';

// Minimal stand-in pending the currently-reading redesign (tests #4–#7). For now
// it only needs to confirm a book reached this page, which the catalog spec (#3)
// asserts via the per-engagement "Mark as finished" action. The redesign extends
// this with the progress-log and resume-point locators.
export class CurrentlyReadingPage {
  /** @param page - The Playwright page to drive currently-reading through. */
  constructor(public readonly page: Page) {}

  /** Navigates to the currently-reading page. */
  async goto(): Promise<void> {
    await this.page.goto('/currently-reading');
  }

  /**
   * Locates the "Mark as finished" button for a book in the currently-reading
   * list. Its presence confirms the book's engagement card is on the page.
   * @param title - The book's title.
   * @returns The mark-as-finished button locator for that book.
   */
  getMarkAsFinishedButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Mark ${title} as finished` });
  }
}
