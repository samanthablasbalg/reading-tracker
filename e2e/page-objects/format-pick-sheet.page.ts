import { Locator, Page } from '@playwright/test';

export type PickableFormat = 'Print' | 'Digital' | 'Audio';

export class FormatPickSheetPage {
  constructor(public readonly page: Page) {}

  /**
   * Locates the format-choice button for a given book and format.
   * @param title - The book's title, as shown in the picker heading.
   * @param format - The format to pick.
   * @returns The button locator.
   */
  getPickButton(title: string, format: PickableFormat): Locator {
    return this.page.getByRole('button', { name: `Start reading ${title} as ${format}` });
  }

  /**
   * Picks a format from the open format picker, closing it on success.
   * @param title - The book's title.
   * @param format - The format to pick.
   */
  async pick(title: string, format: PickableFormat): Promise<void> {
    await this.getPickButton(title, format).click();
  }
}
