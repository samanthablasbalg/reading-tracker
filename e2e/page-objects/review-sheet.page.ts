import { Locator, Page } from '@playwright/test';

export class ReviewSheetPage {
  readonly cancelButton: Locator;

  constructor(public readonly page: Page) {
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  getWholeSelect(title: string): Locator {
    return this.page.getByRole('combobox', { name: `Whole number rating for ${title}` });
  }

  getFractionSelect(title: string): Locator {
    return this.page.getByRole('combobox', { name: `Fractional rating for ${title}` });
  }

  getReviewTextarea(title: string): Locator {
    return this.page.getByRole('textbox', { name: `Review text for ${title}` });
  }

  getSaveButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Save review for ${title}` });
  }
}
