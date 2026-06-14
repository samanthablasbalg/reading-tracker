import { expect, test } from "../fixtures";
import { ApiClient } from "../pages/api-client";
import { CatalogPage } from "../pages/catalog.page";
import { CurrentlyReadingPage } from "../pages/currently-reading.page";
import { FinishedReadsPage } from "../pages/finished-reads.page";

const bookTitle = "Piranesi";
const bookAuthor = "Susanna Clarke";

test("Search for and add book to the catalog", async ({ page }) => {
  const catalog = new CatalogPage(page);
  await test.step("Go to the catalog", async () => {
    await catalog.goto();
  });
  await test.step("Search for the book", async () => {
    await catalog.searchFor(bookTitle);
  });
  await test.step("Add the book to the catalog", async () => {
    await catalog.addBook(bookTitle, bookAuthor);
  });
  await test.step("Verify the book is in the catalog", async () => {
    await expect(catalog.getBookListItem(bookTitle)).toBeVisible();
  });
});

test('Set a book to "Currently Reading"', async ({ page, request }) => {
  await test.step("Create the book", async () => {
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
