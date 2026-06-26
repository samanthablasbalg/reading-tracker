import { expect, test } from '../../fixtures/api-client';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';
import { ProgressLogSheetPage } from '../../page-objects/progress-log-sheet.page';
import { ReadPage } from '../../page-objects/read.page';

test('Logging progress advances the card in place and survives reload', async ({
  page,
  apiClient,
}) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  let initialOrder: string[] = [];

  await test.step('Seed two books, Dune logged to page 100 then Piranesi marked reading most recently', async () => {
    const piranesiId = await apiClient.createBook('Piranesi', 'Susanna Clarke', 272);
    const duneId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    const duneEngId = await apiClient.markAsReading(duneId);
    await apiClient.logProgress(duneEngId, 100);
    await apiClient.markAsReading(piranesiId);
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
  const sheet = new ProgressLogSheetPage(page);
  const read = new ReadPage(page);

  await test.step('Seed a book being read', async () => {
    const bookId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    await apiClient.markAsReading(bookId);
  });

  await test.step('Mark the book as finished', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('Dune');
    await sheet.finishButton.click();
  });

  await test.step('Confirm the finish', async () => {
    await sheet.finishButton.click();
  });

  await test.step('Verify it left Currently reading', async () => {
    await expect(currentlyReading.getBookCard('Dune')).toHaveCount(0);
  });

  await test.step('Verify it appears under Read', async () => {
    await read.goto();
    await expect(read.getFinishedEntry('Dune')).toBeVisible();
  });
});

test('Marking a book finished after entering text causes confirmation flow', async ({
  page,
  apiClient,
}) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);
  const read = new ReadPage(page);

  await test.step('Seed a book being read', async () => {
    const duneId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    const duneEngId = await apiClient.markAsReading(duneId);
    await apiClient.logProgress(duneEngId, 100);
  });

  await test.step('Open the log sheet for Dune', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('Dune');
    await expect(sheet.pageInput).toHaveValue('100');
  });

  await test.step('Enter a higher page', async () => {
    await sheet.enterPage(200);
  });

  await test.step('Mark the book as finished', async () => {
    await sheet.finishButton.click();
  });

  await test.step('Verify confirmation appears', async () => {
    await expect(sheet.confirmationMessage).toBeVisible();
  });

  await test.step('Confirm finish flow', async () => {
    await sheet.finishButton.click();
  });

  await test.step('Verify it left Currently reading', async () => {
    await expect(currentlyReading.getBookCard('Dune')).toHaveCount(0);
  });

  await test.step('Verify it appears under Read', async () => {
    await read.goto();
    await expect(read.getFinishedEntry('Dune')).toBeVisible();
  });
});

test('Audio log sheet shows HH:MM input instead of a page input', async ({ page, apiClient }) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  await test.step('Seed an audio read', async () => {
    const bookId = await apiClient.createBook('The Hobbit', 'J.R.R. Tolkien');
    await apiClient.markAsReading(bookId, 'audio');
  });

  await test.step('Navigate and open the log sheet', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('The Hobbit');
  });

  await test.step('Verify the HH:MM input is shown and the page input is absent', async () => {
    await expect(sheet.minuteInput).toBeVisible();
    await expect(sheet.pageInput).toHaveCount(0);
  });
});

test('Logging audio progress advances the completion percentage', async ({ page, apiClient }) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  await test.step('Seed an audio read with a 2-hour length', async () => {
    const bookId = await apiClient.createBook('The Hobbit', 'J.R.R. Tolkien');
    await apiClient.markAsReading(bookId, 'audio', 120);
  });

  await test.step('Navigate and open the log sheet', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('The Hobbit');
  });

  await test.step('Log 01:00 of progress', async () => {
    await sheet.enterMinute('01:00');
    await sheet.save('The Hobbit');
  });

  await test.step('Verify completion percentage is 50%', async () => {
    await expect(currentlyReading.getProgressBar('The Hobbit')).toHaveAccessibleName(
      'The Hobbit progress: 50%',
    );
  });
});

test('Audio log sheet pre-fills with the last logged minute', async ({ page, apiClient }) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);

  await test.step('Seed an audio read with progress logged to minute 75', async () => {
    const bookId = await apiClient.createBook('The Hobbit', 'J.R.R. Tolkien');
    const engId = await apiClient.markAsReading(bookId, 'audio', 180);
    await apiClient.logAudioProgress(engId, 75);
  });

  await test.step('Navigate and open the log sheet', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('The Hobbit');
  });

  await test.step('Verify the sheet pre-fills with 01:15', async () => {
    await expect(sheet.minuteInput).toHaveValue('01:15');
  });
});

test('Giving up on a book moves it from Currently reading to the DNF section', async ({
  page,
  apiClient,
}) => {
  const currentlyReading = new CurrentlyReadingPage(page);
  const sheet = new ProgressLogSheetPage(page);
  const read = new ReadPage(page);

  await test.step('Seed a book being read with progress', async () => {
    const duneId = await apiClient.createBook('Dune', 'Frank Herbert', 412);
    const duneEngId = await apiClient.markAsReading(duneId);
    await apiClient.logProgress(duneEngId, 100);
  });

  await test.step('Open the sheet and choose to give up', async () => {
    await currentlyReading.goto();
    await currentlyReading.openLogSheet('Dune');
    await sheet.giveUpButton.click();
    await expect(sheet.giveUpConfirmationMessage).toBeVisible();
  });

  await test.step('Confirm the give-up', async () => {
    await sheet.giveUpButton.click();
  });

  await test.step('Verify it left Currently reading', async () => {
    await expect(currentlyReading.getBookCard('Dune')).toHaveCount(0);
  });

  await test.step('Verify it appears under the DNF section', async () => {
    await read.goto();
    await expect(read.getDnfEntry('Dune')).toBeVisible();
  });
});
