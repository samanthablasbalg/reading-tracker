import { Locator, Page } from '@playwright/test';

export class ReadPage {
  readonly finishedSection: Locator;
  readonly dnfSection: Locator;

  /** @param page - The Playwright page to drive the Read page through. */
  constructor(public readonly page: Page) {
    this.finishedSection = page.locator('app-read');
    this.dnfSection = page.locator('app-dnf');
  }

  /** Navigates to the Read page (finished and DNF'd books). */
  async goto(): Promise<void> {
    await this.page.goto('/concluded');
  }

  /**
   * Locates a finished book's entry by title, scoped to the finished section.
   * @param title - The book's title.
   * @returns The entry locator.
   */
  getFinishedEntry(title: string): Locator {
    return this.finishedSection.getByText(title, { exact: true });
  }

  /**
   * Locates a DNF'd book's entry by title, scoped to the DNF section.
   * @param title - The book's title.
   * @returns The entry locator.
   */
  getDnfEntry(title: string): Locator {
    return this.dnfSection.getByText(title, { exact: true });
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
}
