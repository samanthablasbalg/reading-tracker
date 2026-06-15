import { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { ApiClient } from '../pages/api-client';
import { CatalogPage } from '../pages/catalog.page';
import { CurrentlyReadingPage } from '../pages/currently-reading.page';
import { FinishedReadsPage } from '../pages/finished-reads.page';

const bookTitle = 'Piranesi';
const bookAuthor = 'Susanna Clarke';
const googleBooksId = 'e2e-piranesi';

const candidate = {
  google_books_id: googleBooksId,
  title: bookTitle,
  authors: [bookAuthor],
  published_date: '2020-09-15',
  page_count: 245,
  categories: ['Fiction'],
  cover_url: 'https://example.test/piranesi.jpg',
  language: 'en',
};

const importedBook = {
  id: '00000000-0000-0000-0000-000000000001',
  title: bookTitle,
  authors: [{ id: '00000000-0000-0000-0000-000000000002', name: bookAuthor }],
  google_books_id: googleBooksId,
  default_cover_url: 'https://example.test/piranesi.jpg',
  default_page_count: 245,
  original_language: 'en',
  genres: ['Fiction'],
  publication_date: '2020-09-15',
  created_at: '2026-06-14T00:00:00Z',
  updated_at: '2026-06-14T00:00:00Z',
};

async function mockGoogleBooks(page: Page): Promise<void> {
  let imported = false;

  await page.route('**/api/books/search**', (route) => route.fulfill({ json: [candidate] }));

  await page.route('**/api/books/import', (route) => {
    imported = true;
    return route.fulfill({ json: importedBook });
  });

  await page.route('**/api/books', (route) =>
    route.fulfill({ json: imported ? [importedBook] : [] }),
  );
}

test('Search for and add book to the catalog', async ({ page }) => {
  await mockGoogleBooks(page);
  const catalog = new CatalogPage(page);
  await test.step('Go to the catalog', async () => {
    await catalog.goto();
  });
  await test.step('Search for the book', async () => {
    await catalog.searchFor(bookTitle);
  });
  await test.step('Add the book to the catalog', async () => {
    const importRequest = page.waitForRequest('**/api/books/import');
    await catalog.addBook(bookTitle);
    expect((await importRequest).postDataJSON()).toEqual({ google_books_id: googleBooksId });
  });
  await test.step('Verify the book is in the catalog', async () => {
    await expect(catalog.getBookListItem(bookTitle)).toBeVisible();
  });
});

test('Set a book to "Currently Reading"', async ({ page, request }) => {
  await test.step('Create the book', async () => {
    const api = new ApiClient(request);
    await api.createBook(bookTitle, bookAuthor);
  });
  await test.step('Set the book to "Currently Reading"', async () => {
    const catalog = new CatalogPage(page);
    await catalog.goto();
    await catalog.markBookAsReading(bookTitle);
  });
  await test.step('Verify the book is in the "Currently Reading" list', async () => {
    const currentlyReading = new CurrentlyReadingPage(page);
    await currentlyReading.goto();
    await expect(currentlyReading.getBookListItem(bookTitle)).toBeVisible();
  });
});

test('Set a book to "Finished"', async ({ page, request }) => {
  await test.step('Create the book and set it to "Currently Reading"', async () => {
    const api = new ApiClient(request);
    const bookId = await api.createBook(bookTitle, bookAuthor);
    await api.markAsReading(bookId);
  });
  await test.step('Set the book to "Finished"', async () => {
    const currentlyReading = new CurrentlyReadingPage(page);
    await currentlyReading.goto();
    await currentlyReading.markBookFinished(bookTitle);
  });
  await test.step('Verify the book is in the "Finished Reads" list', async () => {
    const finishedReads = new FinishedReadsPage(page);
    await finishedReads.goto();
    await expect(finishedReads.getBookListItem(bookTitle)).toBeVisible();
  });
});
