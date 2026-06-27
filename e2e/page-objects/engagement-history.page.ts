import { Locator, Page } from '@playwright/test';

export class EngagementHistoryPage {
  readonly startDateButton: Locator;
  readonly startDateInput: Locator;
  readonly saveStartDateButton: Locator;
  readonly cancelStartDateButton: Locator;
  readonly finishDateButton: Locator;
  readonly finishDateInput: Locator;
  readonly saveFinishDateButton: Locator;
  readonly cancelFinishDateButton: Locator;
  readonly progressLogs: Locator;
  readonly logDateInput: Locator;
  readonly saveDateButton: Locator;
  readonly cancelDateButton: Locator;
  readonly editProgressRangeButton: Locator;
  readonly pageInput: Locator;
  readonly saveProgressButton: Locator;
  readonly cancelProgressButton: Locator;
  readonly errorAlert: Locator;

  constructor(public readonly page: Page) {
    this.startDateButton = page.getByRole('button', { name: 'Edit start date' });
    this.startDateInput = page.getByRole('textbox', { name: 'start date' });
    this.saveStartDateButton = page.getByRole('button', { name: 'Save start date' });
    this.cancelStartDateButton = page.getByRole('button', { name: 'Cancel start date edit' });
    this.finishDateButton = page.getByRole('button', { name: 'Edit finish date' });
    this.finishDateInput = page.getByRole('textbox', { name: 'finish date' });
    this.saveFinishDateButton = page.getByRole('button', { name: 'Save finish date' });
    this.cancelFinishDateButton = page.getByRole('button', { name: 'Cancel finish date edit' });
    this.progressLogs = page.getByRole('list', { name: 'Progress logs' });
    this.logDateInput = page.getByRole('textbox', { name: 'Edit log date' });
    this.saveDateButton = page.getByRole('button', { name: 'Save date' });
    this.cancelDateButton = page.getByRole('button', { name: 'Cancel date edit' });
    this.editProgressRangeButton = page.getByRole('button', { name: 'Edit progress range' });
    this.pageInput = page.getByRole('spinbutton', { name: 'Edit end page' });
    this.saveProgressButton = page.getByRole('button', { name: 'Save progress' });
    this.cancelProgressButton = page.getByRole('button', { name: 'Cancel progress edit' });
    this.errorAlert = page.getByRole('alert');
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/engagement/${engagementId}`);
  }

  getLogRow(n: number): Locator {
    return this.progressLogs.getByRole('listitem', { name: `Progress log ${n}` });
  }

  getLogDateButton(n: number): Locator {
    return this.getLogRow(n).getByRole('button', { name: /^Edit date:/ });
  }

  getLogEditProgressRangeButton(n: number): Locator {
    return this.getLogRow(n).getByRole('button', { name: 'Edit progress range' });
  }
}
