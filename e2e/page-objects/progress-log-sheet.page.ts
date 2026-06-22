import { Locator, Page } from '@playwright/test';

// The progress-log sheet renders identically whether opened as a dialog (wide
// viewports) or a bottom sheet (narrow), so one set of content locators drives
// both. Instantiated against the same page as the currently-reading POM.
export class ProgressLogSheetPage {
  readonly pageInput: Locator;
  readonly cancelButton: Locator;
  readonly confirmationMessage: Locator;
  readonly finishButton: Locator;
  readonly giveUpButton: Locator;
  readonly giveUpConfirmationMessage: Locator;

  /** @param page - The Playwright page the sheet is open on. */
  constructor(public readonly page: Page) {
    this.pageInput = page.getByRole('spinbutton', { name: 'Current page' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.confirmationMessage = page.getByText('Finish and discard the page you entered');
    this.finishButton = page.getByRole('button', { name: /finish/i });
    this.giveUpButton = page.getByRole('button', { name: /dnf/i });
    this.giveUpConfirmationMessage = page.getByText('Give up on');
  }

  /**
   * Locates the Save button, whose aria-label carries the book title.
   * @param title - The book's title.
   * @returns The save button locator.
   */
  getSaveButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Save progress for ${title}` });
  }

  /**
   * Types a page number into the current-page field.
   * @param page - The page reached.
   */
  async enterPage(page: number): Promise<void> {
    await this.pageInput.fill(String(page));
  }

  /**
   * Saves the logged progress.
   * @param title - The book's title, to target the right Save button.
   */
  async save(title: string): Promise<void> {
    await this.getSaveButton(title).click();
  }
}
