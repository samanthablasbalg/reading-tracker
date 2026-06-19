import { Locator, Page } from '@playwright/test';

export class ReadPage {
  /** @param page - The Playwright page to drive the Read list through. */
  constructor(public readonly page: Page) {}

  /** Navigates to the Read (finished books) page. */
  async goto(): Promise<void> {
    await this.page.goto('/read');
  }

  /**
   * Locates a finished book's entry by its title. The list rows carry no role,
   * so this matches on the visible title text.
   * @param title - The book's title.
   * @returns The entry locator.
   */
  getBookEntry(title: string): Locator {
    return this.page.getByText(title, { exact: true });
  }
}
