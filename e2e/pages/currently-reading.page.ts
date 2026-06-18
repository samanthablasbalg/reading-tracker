import { Locator, Page } from '@playwright/test';

export class CurrentlyReadingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/currently-reading');
  }

  getBookListItem(title: string): Locator {
    return this.page.locator('mat-list-item').filter({ hasText: title });
  }

  getMarkFinishedButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Mark ${title} as finished` });
  }

  getLogProgressButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Log progress for ${title}` });
  }

  getSheetPageInput(): Locator {
    return this.page.getByRole('spinbutton', { name: 'Current page' });
  }

  getSaveButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Save progress for ${title}` });
  }

  getResumeFromText(title: string): Locator {
    return this.getBookListItem(title).getByText(/Resuming from p\./);
  }

  getCompletionPctText(title: string): Locator {
    return this.getBookListItem(title).getByText(/% complete/);
  }

  async markBookFinished(title: string): Promise<void> {
    await this.getMarkFinishedButton(title).click();
  }

  async logProgress(title: string, currentPage: number): Promise<void> {
    await this.getLogProgressButton(title).click();
    await this.getSheetPageInput().fill(String(currentPage));
    await this.getSaveButton(title).click();
  }
}
