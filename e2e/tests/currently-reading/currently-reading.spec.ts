import { expect, test } from '../../fixtures/api-client';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';
import { ProgressLogSheetPage } from '../../page-objects/progress-log-sheet.page';
import { ReadPage } from '../../page-objects/read.page';

test('Logging progress advances the card in place and survives reload', async ({ page, apiClient }) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  let initialOrder: string[] = [];

  await test.step('Seed two books being read, with Dune already at page 100', async () => {
    const piranesiId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    const duneId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    await apiClient.markAsReading(piranesiId);
    const duneEngId = await apiClient.markAsReading(duneId);
    await apiClient.logProgress(duneEngId, 100);
  });

  await test.step('Navigate and record the initial card order', async () => {
    await currentlyReading.goto();
    initialOrder = await currentlyReading.getCardTitlesInOrder();
  });

  await test.step('Open the log sheet for Dune', async () => {
    await currentlyReading.openLogSheet('Dune');
    await expect(sheet.pageInput).toHaveValue('100');
  });

  await test.step('Log a higher page', async () => {
    await sheet.enterPage(200);
    await sheet.save('Dune');
  });

  await test.step('Verify the progress bar advanced', async () => {
    await expect(currentlyReading.getProgressBar('Dune')).toHaveAccessibleName(
      'Dune progress: 49%'
    );
  });

  await test.step('Verify the list order is unchanged after logging', async () => {
    expect(await currentlyReading.getCardTitlesInOrder()).toEqual(initialOrder);
  });

  await test.step('Verify progress survives a reload and Dune is now first', async () => {
    await page.reload();
    await expect(currentlyReading.getProgressBar('Dune')).toHaveAccessibleName(
      'Dune progress: 49%'
    );
    expect(await currentlyReading.getCardTitlesInOrder()).toEqual(['Dune', 'Piranesi']);
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
