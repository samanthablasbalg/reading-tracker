import { expect, test } from '../../fixtures/api-client';
import { DnfBooksPage } from '../../page-objects/dnf-books.page';
import { ReviewSheetPage } from '../../page-objects/review-sheet.page';

test('DNF books support adding a review the same way finished books do', async ({
  page,
  apiClient,
}) => {
  const dnfBooks = new DnfBooksPage(page);
  const sheet = new ReviewSheetPage(page);

  await test.step('Seed a DNF book with no review', async () => {
    const bookId = await apiClient.createBook('Infinite Jest', 'David Foster Wallace');
    const engId = await apiClient.markAsReading(bookId);
    await apiClient.markAsDnf(engId);
  });

  await test.step('Navigate and open the review sheet', async () => {
    await dnfBooks.goto();
    await dnfBooks.getAddReviewButton('Infinite Jest').click();
  });

  await test.step('Enter a rating and save', async () => {
    await sheet.getWholeSelect('Infinite Jest').selectOption('2');
    await sheet.getSaveButton('Infinite Jest').click();
  });

  await test.step('Verify review summary appears and button changes to Edit review', async () => {
    await expect(dnfBooks.getReviewSummary('Infinite Jest')).toHaveText('2.00 ★');
    await expect(dnfBooks.getEditReviewButton('Infinite Jest')).toBeVisible();
  });
});
