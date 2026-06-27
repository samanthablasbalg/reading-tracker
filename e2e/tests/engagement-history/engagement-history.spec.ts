import { expect, test } from '../../fixtures/api-client';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';
import { EngagementHistoryPage } from '../../page-objects/engagement-history.page';

test('History page is reachable from currently reading and lists logs with dates', async ({
  page,
  apiClient,
}) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const history = new EngagementHistoryPage(page);

  await test.step('Seed a book in progress with two logged entries', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.logProgress(engId, 50);
    await apiClient.logProgress(engId, 100);
  });

  await test.step('Navigate to the history page via the currently-reading shelf', async () => {
    await currentlyReading.goto();
    await currentlyReading.getViewHistoryButton('Piranesi').click();
  });

  await test.step('Verify both log rows and the start/finish date fields are shown', async () => {
    await expect(history.progressLogs).toBeVisible();
    await expect(history.getLogRow(1)).toBeVisible();
    await expect(history.getLogRow(2)).toBeVisible();
    await expect(history.startDateButton).toBeVisible();
    await expect(history.finishDateButton).toBeVisible();
  });
});

test('Editing a progress log date persists and renders the new date', async ({
  page,
  apiClient,
}) => {
  const history = new EngagementHistoryPage(page);

  let engId = '';

  await test.step('Seed a book with an early start date and one logged entry', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    engId = await apiClient.markAsReading(bookId);
    await apiClient.patchEngagementDates(engId, { started_on: '2025-01-01' });
    await apiClient.logProgress(engId, 50);
  });

  await test.step('Navigate to the history page', async () => {
    await history.goto(engId);
  });

  await test.step('Open the date editor and set a new date', async () => {
    await history.getLogDateButton(1).click();
    await history.logDateInput.fill('2025-06-15');
    await history.saveDateButton.click();
  });

  await test.step('Verify the new date is displayed and edit mode closed', async () => {
    await expect(history.logDateInput).toHaveCount(0);
    await expect(history.getLogDateButton(1)).toHaveText('Jun 15, 2025');
  });
});

test('Editing the most recent log page persists and shows the updated range', async ({
  page,
  apiClient,
}) => {
  const history = new EngagementHistoryPage(page);

  let engId = '';

  await test.step('Seed a book with one logged entry at page 50', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    engId = await apiClient.markAsReading(bookId);
    await apiClient.logProgress(engId, 50);
  });

  await test.step('Navigate to the history page', async () => {
    await history.goto(engId);
  });

  await test.step('Open the page editor and set a higher page', async () => {
    await history.editProgressRangeButton.click();
    await history.pageInput.fill('100');
    await history.saveProgressButton.click();
  });

  await test.step('Verify the updated range is displayed and edit mode closed', async () => {
    await expect(history.pageInput).toHaveCount(0);
    await expect(history.editProgressRangeButton).toHaveText('pp. 0–100');
  });
});

test('Editing the engagement start date persists and renders the new date', async ({
  page,
  apiClient,
}) => {
  const history = new EngagementHistoryPage(page);

  let engId = '';

  await test.step('Seed a book in progress', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    engId = await apiClient.markAsReading(bookId);
  });

  await test.step('Navigate to the history page', async () => {
    await history.goto(engId);
  });

  await test.step('Open the start date editor and set a past date', async () => {
    await history.startDateButton.click();
    await history.startDateInput.fill('2025-01-01');
    await history.saveStartDateButton.click();
  });

  await test.step('Verify the new start date is displayed and edit mode closed', async () => {
    await expect(history.startDateInput).toHaveCount(0);
    await expect(history.startDateButton).toHaveText('Jan 1, 2025');
  });
});
