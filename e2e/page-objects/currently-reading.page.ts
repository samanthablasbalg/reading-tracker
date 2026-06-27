import { Locator, Page } from '@playwright/test';

export class CurrentlyReadingPage {
  /** @param page - The Playwright page to drive currently-reading through. */
  constructor(public readonly page: Page) {}

  /** Navigates to the currently-reading page. */
  async goto(): Promise<void> {
    await this.page.goto('/currently-reading');
  }

  /**
   * Locates the "Log progress" button for a book's card. Identified by its
   * aria-label, so it works across all three responsive layouts (the visible
   * title is hidden on narrow viewports).
   * @param title - The book's title.
   * @returns The log-progress button locator.
   */
  getLogProgressButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Log progress for ${title}` });
  }

  /**
   * Locates a book's progress indicator. Both the wide-viewport bar and the
   * narrower-viewport spinner expose the same `<title> progress: N%` accessible
   * name, so this matches regardless of layout.
   * @param title - The book's title.
   * @returns The progressbar locator.
   */
  getProgressBar(title: string): Locator {
    return this.page.getByRole('progressbar', { name: `${title} progress:` });
  }

  /**
   * Opens the progress-log sheet for a book (a dialog on wide viewports, a
   * bottom sheet on narrow ones — same content either way).
   * @param title - The book's title.
   */
  async openLogSheet(title: string): Promise<void> {
    await this.getLogProgressButton(title).click();
  }

  /**
   * Locates a book's card by its title.
   * @param title - The book's title.
   * @returns The card locator.
   */
  getBookCard(title: string): Locator {
    return this.page.getByRole('listitem', { name: title });
  }

  /**
   * Locates the format icon on a book's card.
   * @param title - The book's title.
   * @param format - The expected format (e.g. 'audio', 'print', 'digital').
   * @returns The icon locator.
   */
  getFormatIcon(title: string, format: string): Locator {
    return this.getBookCard(title).getByRole('img', { name: `Format: ${format}` });
  }

  /**
   * Locates the "View history" button for a book's card.
   * @param title - The book's title.
   * @returns The view-history button locator.
   */
  getViewHistoryButton(title: string): Locator {
    return this.page.getByRole('button', { name: `View history for ${title}` });
  }

  /**
   * Returns the book titles in their current DOM order, derived from the
   * aria-label on each listitem card.
   */
  async getCardTitlesInOrder(): Promise<string[]> {
    return this.page
      .getByRole('listitem')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  }
}
