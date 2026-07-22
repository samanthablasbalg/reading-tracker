import { Locator, Page } from '@playwright/test';

export type PickableFormat = 'Print' | 'Digital' | 'Audio';
export type PickableStatus = 'Reading' | 'Finished' | 'DNF';

export class FormatPickSheetPage {
  constructor(public readonly page: Page) {}

  /**
   * Locates the format-choice button for a given book and format. Also serves
   * as the submit button in the audio-length collection step (same aria-label).
   * @param title - The book's title, as shown in the picker heading.
   * @param format - The format to pick.
   * @returns The button locator.
   */
  getPickButton(title: string, format: PickableFormat): Locator {
    return this.page.getByRole('button', { name: `Start reading ${title} as ${format}` });
  }

  /**
   * Locates the status-choice button, shown as the sheet's first step when
   * more than one status is offered (e.g. from search's Import/Add flow),
   * before format-picking.
   * @param title - The book's title, as shown in the picker heading.
   * @param status - The status to pick.
   * @returns The button locator.
   */
  getStatusButton(title: string, status: PickableStatus): Locator {
    return this.page.getByRole('button', { name: `Add ${title} as ${status}` });
  }

  /**
   * Picks a status from the sheet's status-choice step.
   * @param title - The book's title.
   * @param status - The status to pick.
   */
  async chooseStatus(title: string, status: PickableStatus): Promise<void> {
    await this.getStatusButton(title, status).click();
  }

  /**
   * Dismisses the sheet via its bail-out button, whatever it's labeled.
   * @param label - The button's label; defaults to "Cancel".
   */
  async dismiss(label = 'Cancel'): Promise<void> {
    await this.page.getByRole('button', { name: label }).click();
  }

  /** Locates the HH:MM length input shown when starting an audio book with no known length. */
  getAudioLengthInput(): Locator {
    return this.page.getByRole('textbox', { name: 'How long is the audiobook?' });
  }

  /**
   * Picks a format from the open format picker, closing it on success.
   * For Audio when the book has no stored length, pass `audioLengthHhmm` to
   * fill the intermediate length form; omit it when the book already has a
   * length (the picker skips the form and starts the read immediately).
   * @param title - The book's title.
   * @param format - The format to pick.
   * @param audioLengthHhmm - Required for Audio when the book has no stored length.
   */
  async pick(title: string, format: PickableFormat, audioLengthHhmm?: string): Promise<void> {
    await this.getPickButton(title, format).click();
    if (format === 'Audio' && audioLengthHhmm !== undefined) {
      await this.getAudioLengthInput().fill(audioLengthHhmm);
      await this.getPickButton(title, format).click();
    }
  }
}
