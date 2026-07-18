import { Locator, Page } from '@playwright/test';

export class FinishedBooksPage {
  readonly section: Locator;

  /** @param page - The Playwright page to drive the Finished books page through. */
  constructor(public readonly page: Page) {
    this.section = page.locator('app-read');
  }

  /** Navigates to the Finished books page. */
  async goto(): Promise<void> {
    await this.page.goto('/finished');
  }

  /**
   * Locates a finished book's entry by title.
   * @param title - The book's title.
   * @returns The entry locator.
   */
  getEntry(title: string): Locator {
    return this.section.getByText(title, { exact: true });
  }

  getAddReviewButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Add review for ${title}` });
  }

  getEditReviewButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Edit review for ${title}` });
  }

  getReviewSummary(title: string): Locator {
    return this.page.getByLabel(`Review summary for ${title}`);
  }

  /**
   * Locates the "Delete" button for an engagement on the Finished books page.
   * @param title - The book's title.
   * @returns The delete button locator for that engagement.
   */
  getDeleteButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${title}`, exact: true });
  }

  /**
   * Deletes an engagement from the Finished books page, accepting the native confirm dialog.
   * @param title - The book's title.
   */
  async deleteEngagement(title: string): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.getDeleteButton(title).click();
  }
}
