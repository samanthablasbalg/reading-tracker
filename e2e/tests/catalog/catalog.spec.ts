import { expect, test } from '../../fixtures/api-client';
import { CatalogPage } from '../../page-objects/catalog.page';
import { CurrentlyReadingPage } from '../../page-objects/currently-reading.page';

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

test('Deleting a book with no engagements removes it from the library', async ({
  page,
  apiClient,
}) => {
  const catalog = new CatalogPage(page);

  await test.step('Create a book with no engagements', async () => {
    await apiClient.createBook('Piranesi', 'Susanna Clarke');
  });

  await test.step('Delete the book from the catalog', async () => {
    await catalog.goto();
    await catalog.deleteBook('Piranesi');
  });

  await test.step('Verify it no longer appears in the library', async () => {
    await expect(catalog.getMarkAsReadingButton('Piranesi')).toHaveCount(0);
  });
});
