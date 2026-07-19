import { Locator, Page } from '@playwright/test';

// The progress-log sheet renders identically whether opened as a dialog (wide
// viewports) or a bottom sheet (narrow), so one set of content locators drives
// both. Instantiated against the same page as the currently-reading POM.
export class ProgressLogSheetPage {
  readonly pageInput: Locator;
  readonly minuteInput: Locator;
  readonly cancelButton: Locator;
  readonly confirmationMessage: Locator;
  readonly finishButton: Locator;
  readonly giveUpButton: Locator;
  readonly giveUpConfirmationMessage: Locator;
  readonly dateToggleButton: Locator;
  readonly dateInput: Locator;

  /** @param page - The Playwright page the sheet is open on. */
  constructor(public readonly page: Page) {
    this.pageInput = page.getByRole('spinbutton', { name: 'To · now' });
    this.minuteInput = page.getByRole('textbox', { name: 'To · now' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.confirmationMessage = page.getByText('Finish and discard the page you entered');
    this.finishButton = page.getByRole('button', { name: /finish/i });
    this.giveUpButton = page.getByRole('button', { name: /dnf/i });
    this.giveUpConfirmationMessage = page.getByText('Give up on');
    this.dateToggleButton = page.getByRole('button', { name: 'Log for a different day' });
    this.dateInput = page.getByRole('textbox', { name: 'Log date' });
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
   * Locates the static "From" value showing the position last logged before this sheet opened.
   * @param value - The expected displayed value, e.g. '100' or '01:15'.
   * @returns The From-value locator.
   */
  getFromDisplay(value: string): Locator {
    return this.page.getByText(value, { exact: true });
  }

  /**
   * Types a page number into the current-page field.
   * @param page - The page reached.
   */
  async enterPage(page: number): Promise<void> {
    await this.pageInput.fill(String(page));
  }

  /**
   * Types a position into the HH:MM field for audio reads.
   * @param hhmm - The position in HH:MM format.
   */
  async enterMinute(hhmm: string): Promise<void> {
    await this.minuteInput.fill(hhmm);
  }

  /**
   * Saves the logged progress.
   * @param title - The book's title, to target the right Save button.
   */
  async save(title: string): Promise<void> {
    await this.getSaveButton(title).click();
  }

  /** Reveals the log-date input for backdating a log to a past day. */
  async openDatePicker(): Promise<void> {
    await this.dateToggleButton.click();
  }

  /**
   * Sets the log date, for backdating a log to a past day.
   * @param date - The date in yyyy-mm-dd format.
   */
  async setDate(date: string): Promise<void> {
    await this.dateInput.fill(date);
  }
}
