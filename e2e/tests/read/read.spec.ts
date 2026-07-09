import { expect, test } from '../../fixtures/api-client';
import { CatalogPage } from '../../page-objects/catalog.page';
import { ReadPage } from '../../page-objects/read.page';
import { ReviewSheetPage } from '../../page-objects/review-sheet.page';

test('Read view shows "Add review" for a finished book without a review', async ({
  page,
  apiClient,
}) => {
  const read = new ReadPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Dune', 'Frank Herbert');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate to the Read page', async () => {
    await read.goto();
  });

  await test.step('Verify "Add review" button is visible', async () => {
    await expect(read.getAddReviewButton('Dune')).toBeVisible();
  });
});

test('Saving a rating and review text persists them and shows a summary', async ({
  page,
  apiClient,
}) => {
  const read = new ReadPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Normal People', 'Sally Rooney');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate and open the review sheet', async () => {
    await read.goto();
    await read.getAddReviewButton('Normal People').click();
  });

  await test.step('Enter rating 4.25 and review text', async () => {
    await sheet.getWholeSelect('Normal People').selectOption('4');
    await sheet.getFractionSelect('Normal People').selectOption('25');
    await sheet.getReviewTextarea('Normal People').fill('Quiet and devastating.');
    await sheet.getSaveButton('Normal People').click();
  });

  await test.step('Verify review summary and "Edit review" button are visible', async () => {
    await expect(read.getReviewSummary('Normal People')).toHaveText(
      '4.25 ★ · Quiet and devastating.'
    );
    await expect(read.getEditReviewButton('Normal People')).toBeVisible();
  });
});

test('Saving a rating without review text shows only the star rating in the summary', async ({
  page,
  apiClient,
}) => {
  const read = new ReadPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate and open the review sheet', async () => {
    await read.goto();
    await read.getAddReviewButton('Piranesi').click();
  });

  await test.step('Enter rating 5.00 with no body and save', async () => {
    await sheet.getWholeSelect('Piranesi').selectOption('5');
    await sheet.getSaveButton('Piranesi').click();
  });

  await test.step('Verify summary shows only the star rating', async () => {
    await expect(read.getReviewSummary('Piranesi')).toHaveText('5.00 ★');
  });
});

test('Editing an existing review replaces the displayed summary', async ({ page, apiClient }) => {
  const read = new ReadPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with an existing review', async () => {
    const bookId = await apiClient.createBook('Babel', 'R.F. Kuang');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
    await apiClient.upsertReview(engId, 3.0, 'Good but dense.');
  });

  await test.step('Navigate and open the edit review sheet', async () => {
    await read.goto();
    await read.getEditReviewButton('Babel').click();
  });

  await test.step('Change rating to 5.00, clear the body, and save', async () => {
    await sheet.getWholeSelect('Babel').selectOption('5');
    await sheet.getReviewTextarea('Babel').fill('');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/engagements') && r.status() === 200),
      sheet.getSaveButton('Babel').click(),
    ]);
  });

  await test.step('Verify summary updated to the new rating only', async () => {
    await expect(read.getReviewSummary('Babel')).toHaveText('5.00 ★');
  });
});

test('Deleting a finished engagement with a review removes it and leaves the book in the catalog', async ({
  page,
  apiClient,
}) => {
  const read = new ReadPage(page);
  const catalog = new CatalogPage(page);

  await test.step('Seed a finished book with a review', async () => {
    const bookId = await apiClient.createBook('Babel', 'R.F. Kuang');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
    await apiClient.upsertReview(engId, 3.0, 'Good but dense.');
  });

  await test.step('Delete the engagement from the Read page', async () => {
    await read.goto();
    await read.deleteEngagement('Babel');
  });

  await test.step('Verify it no longer appears under Read', async () => {
    await expect(read.getFinishedEntry('Babel')).toHaveCount(0);
  });

  await test.step('Verify the book remains in the catalog', async () => {
    await catalog.goto();
    await expect(catalog.getMarkAsReadingButton('Babel')).toBeVisible();
  });
});

test('DNF books support adding a review the same way finished books do', async ({
  page,
  apiClient,
}) => {
  const read = new ReadPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a DNF book with no review', async () => {
    const bookId = await apiClient.createBook('Infinite Jest', 'David Foster Wallace');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsDnf(engId);
  });

  await test.step('Navigate and open the review sheet from the DNF section', async () => {
    await read.goto();
    await read.getAddReviewButton('Infinite Jest').click();
  });

  await test.step('Enter a rating and save', async () => {
    await sheet.getWholeSelect('Infinite Jest').selectOption('2');
    await sheet.getSaveButton('Infinite Jest').click();
  });

  await test.step('Verify review summary appears and button changes to Edit review', async () => {
    await expect(read.getReviewSummary('Infinite Jest')).toHaveText('2.00 ★');
    await expect(read.getEditReviewButton('Infinite Jest')).toBeVisible();
  });
});
