import { Locator, Page } from '@playwright/test';

export class CurrentlyReadingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/currently-reading');
  }

  getMarkFinishedButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Mark ${title} as finished` });
  }

  getBookListItem(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  async markBookFinished(title: string): Promise<void> {
    await this.getMarkFinishedButton(title).click();
  }
}
