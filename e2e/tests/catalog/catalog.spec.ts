import { expect, test } from '../../fixtures/api-client';
import { CatalogPage, LibraryBook, SearchCandidate } from '../../page-objects/catalog.page';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';

const candidate: SearchCandidate = {
  google_books_id: 'e2e-piranesi',
  title: 'Piranesi',
  authors: ['Susanna Clarke'],
  published_date: '2020-09-15',
  page_count: 245,
  categories: ['Fiction'],
  cover_url: 'https://example.test/piranesi.jpg',
  language: 'en',
};

const importedBook: LibraryBook = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Piranesi',
  authors: [{ id: '00000000-0000-0000-0000-000000000002', name: 'Susanna Clarke' }],
};

test('Searching for and adding a book lists it in the catalog', async ({ page }) => {
  const catalog = new CatalogPage(page);

  await test.step('Open the catalog with a stubbed import flow', async () => {
    await catalog.stubBookImportFlow(candidate, importedBook);
    await catalog.goto();
  });

  await test.step('Search for the book', async () => {
    await catalog.searchFor('Piranesi');
    await expect(catalog.getAddButton('Piranesi')).toBeVisible();
  });

  await test.step('Add the book to the library', async () => {
    await catalog.addBook('Piranesi');
  });

  await test.step('Verify the book appears in the library', async () => {
    await expect(catalog.getMarkAsReadingButton('Piranesi')).toBeVisible();
  });
});

test('A failed search shows an error, not a crash', async ({ page, apiClient }) => {
  const catalog = new CatalogPage(page);

  await test.step('Seed a book and stub a failing search', async () => {
    await apiClient.createBook('Piranesi', 'Susanna Clarke');
    await catalog.stubSearchFailure();
    await catalog.goto();
  });

  await test.step('Search while the backend is failing', async () => {
    await catalog.searchFor('Piranesi');
  });

  await test.step('Verify the error shows and the library is untouched', async () => {
    await expect(catalog.searchError).toBeVisible();
    await expect(catalog.getMarkAsReadingButton('Piranesi')).toBeVisible();
    await expect(catalog.getAddButton('Piranesi')).toHaveCount(0);
  });
});

test('Marking a catalog book as reading moves it to Currently reading', async ({
  page,
  apiClient,
}) => {
  const catalog = new CatalogPage(page);
  const currentlyReading = new CurrentlyReadingPage(page);

  await test.step('Create a book in the library', async () => {
    await apiClient.createBook('Piranesi', 'Susanna Clarke');
  });

  await test.step('Mark the book as reading from the catalog', async () => {
    await catalog.goto();
    await catalog.markAsReading('Piranesi');
  });

  await test.step('Verify it appears under Currently reading', async () => {
    await currentlyReading.goto();
    await expect(currentlyReading.getBookCard('Piranesi')).toBeVisible();
  });
});

test('Starting a book as audio shows the audio icon on the Currently Reading row', async ({
  page,
  apiClient,
}) => {
  const catalog = new CatalogPage(page);
  const currentlyReading = new CurrentlyReadingPage(page);

  await test.step('Create a book in the library', async () => {
    await apiClient.createBook('Piranesi', 'Susanna Clarke');
  });

  await test.step('Start the book as audio from the catalog', async () => {
    await catalog.goto();
    await catalog.markAsReading('Piranesi', 'Audio', '10:00');
  });

  await test.step('Verify the audio icon appears on the Currently Reading row', async () => {
    await currentlyReading.goto();
    await expect(currentlyReading.getFormatIcon('Piranesi', 'audio')).toBeVisible();
  });
});
