import { expect, test } from '../../fixtures/api-client';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';
import { ProgressLogSheetPage } from '../../page-objects/progress-log-sheet.page';
import { ReadPage } from '../../page-objects/read.page';

test('Logging progress advances the card and survives reload', async ({ page, apiClient }) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  await test.step('Seed a book being read with a logged page', async () => {
    const bookId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    const engagementId = await apiClient.markAsReading(bookId);
    await apiClient.logProgress(engagementId, 100);
  });

  await test.step('Open the log sheet', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('Dune');
    await expect(sheet.pageInput).toHaveValue('100');
  });

  await test.step('Log a higher page', async () => {
    await sheet.enterPage(200);
    await sheet.save('Dune');
  });

  await test.step('Verify the card progress advanced', async () => {
    await expect(currentlyReading.getProgressBar('Dune')).toHaveAccessibleName(
      'Dune progress: 49%'
    );
  });

  await test.step('Verify it survives a reload', async () => {
    await page.reload();
    await expect(currentlyReading.getProgressBar('Dune')).toHaveAccessibleName(
      'Dune progress: 49%'
    );
  });
});

test('Marking a book finished moves it from Currently reading to Read', async ({
  page,
  apiClient,
}) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const read = new ReadPage(page);

  await test.step('Seed a book being read', async () => {
    const bookId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    await apiClient.markAsReading(bookId);
  });

  await test.step('Mark the book as finished', async () => {
    await currentlyReading.goto();
    await currentlyReading.markAsFinished('Dune');
  });

  await test.step('Verify it left Currently reading', async () => {
    await expect(currentlyReading.getMarkAsFinishedButton('Dune')).toHaveCount(0);
  });

  await test.step('Verify it appears under Read', async () => {
    await read.goto();
    await expect(read.getBookEntry('Dune')).toBeVisible();
  });
});
