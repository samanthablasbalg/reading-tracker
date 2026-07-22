import { Locator, Page } from '@playwright/test';
import { FormatPickSheetPage, PickableFormat } from './format-pick-sheet.page';

export class CatalogPage {
  /** @param page - The Playwright page to drive the catalog through. */
  constructor(public readonly page: Page) {}

  /** Navigates to the catalog page. */
  async goto(): Promise<void> {
    await this.page.goto('/catalog');
  }

  /**
   * Locates the "Mark as reading" button for a book in the library list.
   * @param title - The library book's title.
   * @returns The mark-as-reading button locator for that book.
   */
  getMarkAsReadingButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Mark ${title} as reading` });
  }

  /**
   * Marks a library book as currently reading in the given format.
   * Clicks the button to open the format picker, then picks the format.
   * @param title - The library book's title.
   * @param format - The format to start reading in (defaults to Print).
   * @param audioLengthHhmm - Required for Audio when the book has no stored length.
   */
  async markAsReading(
    title: string,
    format: PickableFormat = 'Print',
    audioLengthHhmm?: string
  ): Promise<void> {
    await this.getMarkAsReadingButton(title).click();
    await new FormatPickSheetPage(this.page).pick(title, format, audioLengthHhmm);
  }

  /**
   * Locates the "Delete" button for a book in the library list.
   * @param title - The library book's title.
   * @returns The delete button locator for that book.
   */
  getDeleteButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${title}`, exact: true });
  }

  /**
   * Deletes a library book, accepting the native confirm dialog.
   * @param title - The library book's title.
   */
  async deleteBook(title: string): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.getDeleteButton(title).click();
  }
}
