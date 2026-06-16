import { expect, test } from '../fixtures';
import { ApiClient } from '../pages/api-client';
import { CurrentlyReadingPage } from '../pages/currently-reading.page';

const bookTitle = 'Piranesi';
const bookAuthor = 'Susanna Clarke';

test('Log progress — resume-from and completion % appear after first log', async ({
  page,
  request,
}) => {
  await test.step('Seed: book with page count + engagement', async () => {
    const api = new ApiClient(request);
    const bookId = await api.createBook(bookTitle, bookAuthor, 245);
    await api.markAsReading(bookId);
  });

  const currentlyReading = new CurrentlyReadingPage(page);

  await test.step('Go to currently-reading — no resume-from or % yet', async () => {
    await currentlyReading.goto();
    await expect(currentlyReading.getResumeFromText(bookTitle)).not.toBeVisible();
    await expect(currentlyReading.getCompletionPctText(bookTitle)).not.toBeVisible();
  });

  await test.step('Log page 123', async () => {
    await currentlyReading.logProgress(bookTitle, 123);
  });

  await test.step('Resume-from and % appear; input clears', async () => {
    await expect(currentlyReading.getResumeFromText(bookTitle)).toHaveText('Resuming from p.123');
    await expect(currentlyReading.getCompletionPctText(bookTitle)).toHaveText('50% complete');
    await expect(currentlyReading.getPageInput(bookTitle)).toHaveValue('');
  });
});

test('Log progress — second log updates resume-from page', async ({ page, request }) => {
  await test.step('Seed: book + engagement + first log at page 100', async () => {
    const api = new ApiClient(request);
    const bookId = await api.createBook(bookTitle, bookAuthor);
    const engagementId = await api.markAsReading(bookId);
    await api.logProgress(engagementId, 100);
  });

  const currentlyReading = new CurrentlyReadingPage(page);

  await test.step('Go to currently-reading — seeded log is reflected', async () => {
    await currentlyReading.goto();
    await expect(currentlyReading.getResumeFromText(bookTitle)).toHaveText('Resuming from p.100');
  });

  await test.step('Log page 200', async () => {
    await currentlyReading.logProgress(bookTitle, 200);
  });

  await test.step('Resume-from updates to p.200', async () => {
    await expect(currentlyReading.getResumeFromText(bookTitle)).toHaveText('Resuming from p.200');
  });
});

test('Log progress — backward page shows error on button', async ({ page, request }) => {
  await test.step('Seed: book + engagement + log at page 100', async () => {
    const api = new ApiClient(request);
    const bookId = await api.createBook(bookTitle, bookAuthor);
    const engagementId = await api.markAsReading(bookId);
    await api.logProgress(engagementId, 100);
  });

  const currentlyReading = new CurrentlyReadingPage(page);

  await test.step('Go to currently-reading', async () => {
    await currentlyReading.goto();
    await expect(currentlyReading.getBookListItem(bookTitle)).toBeVisible();
  });

  await test.step('Enter page 50 (below last log) and submit', async () => {
    await currentlyReading.logProgress(bookTitle, 50);
  });

  await test.step('Button shows Error', async () => {
    await expect(currentlyReading.getLogProgressButton(bookTitle)).toHaveText('Error');
  });
});
