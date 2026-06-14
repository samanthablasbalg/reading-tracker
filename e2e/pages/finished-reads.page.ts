import { Locator, Page } from '@playwright/test';

export class FinishedReadsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/read');
  }

  getBookListItem(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }
}
