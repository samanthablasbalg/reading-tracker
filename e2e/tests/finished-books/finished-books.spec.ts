import { expect, test } from '../../fixtures/api-client';
import { CatalogPage } from '../../page-objects/catalog.page';
import { FinishedBooksPage } from '../../page-objects/finished-books.page';
import { ReviewSheetPage } from '../../page-objects/review-sheet.page';

test('Finished books page shows "Add review" for a finished book without a review', async ({
  page,
  apiClient,
}) => {
  const finishedBooks = new FinishedBooksPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Dune', 'Frank Herbert');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate to the Finished books page', async () => {
    await finishedBooks.goto();
  });

  await test.step('Verify "Add review" button is visible', async () => {
    await expect(finishedBooks.getAddReviewButton('Dune')).toBeVisible();
  });
});

test('Saving a rating and review text persists them and shows a summary', async ({
  page,
  apiClient,
}) => {
  const finishedBooks = new FinishedBooksPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Normal People', 'Sally Rooney');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate and open the review sheet', async () => {
    await finishedBooks.goto();
    await finishedBooks.getAddReviewButton('Normal People').click();
  });

  await test.step('Enter rating 4.25 and review text', async () => {
    await sheet.getWholeSelect('Normal People').selectOption('4');
    await sheet.getFractionSelect('Normal People').selectOption('25');
    await sheet.getReviewTextarea('Normal People').fill('Quiet and devastating.');
    await sheet.getSaveButton('Normal People').click();
  });

  await test.step('Verify review summary and "Edit review" button are visible', async () => {
    await expect(finishedBooks.getReviewSummary('Normal People')).toHaveText(
      '4.25 ★ · Quiet and devastating.'
    );
    await expect(finishedBooks.getEditReviewButton('Normal People')).toBeVisible();
  });
});

test('Saving a rating without review text shows only the star rating in the summary', async ({
  page,
  apiClient,
}) => {
  const finishedBooks = new FinishedBooksPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with no review', async () => {
    const bookId = await apiClient.createBook('Piranesi', 'Susanna Clarke');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
  });

  await test.step('Navigate and open the review sheet', async () => {
    await finishedBooks.goto();
    await finishedBooks.getAddReviewButton('Piranesi').click();
  });

  await test.step('Enter rating 5.00 with no body and save', async () => {
    await sheet.getWholeSelect('Piranesi').selectOption('5');
    await sheet.getSaveButton('Piranesi').click();
  });

  await test.step('Verify summary shows only the star rating', async () => {
    await expect(finishedBooks.getReviewSummary('Piranesi')).toHaveText('5.00 ★');
  });
});

test('Editing an existing review replaces the displayed summary', async ({ page, apiClient }) => {
  const finishedBooks = new FinishedBooksPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a finished book with an existing review', async () => {
    const bookId = await apiClient.createBook('Babel', 'R.F. Kuang');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
    await apiClient.upsertReview(engId, 3.0, 'Good but dense.');
  });

  await test.step('Navigate and open the edit review sheet', async () => {
    await finishedBooks.goto();
    await finishedBooks.getEditReviewButton('Babel').click();
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
    await expect(finishedBooks.getReviewSummary('Babel')).toHaveText('5.00 ★');
  });
});

test('Deleting a finished engagement with a review removes it and leaves the book in the catalog', async ({
  page,
  apiClient,
}) => {
  const finishedBooks = new FinishedBooksPage(page);
  const catalog = new CatalogPage(page);

  await test.step('Seed a finished book with a review', async () => {
    const bookId = await apiClient.createBook('Babel', 'R.F. Kuang');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsFinished(engId);
    await apiClient.upsertReview(engId, 3.0, 'Good but dense.');
  });

  await test.step('Delete the engagement from the Finished books page', async () => {
    await finishedBooks.goto();
    await finishedBooks.deleteEngagement('Babel');
  });

  await test.step('Verify it no longer appears under Finished', async () => {
    await expect(finishedBooks.getEntry('Babel')).toHaveCount(0);
  });

  await test.step('Verify the book remains in the catalog', async () => {
    await catalog.goto();
    await expect(catalog.getMarkAsReadingButton('Babel')).toBeVisible();
  });
});
