import { Locator, Page } from "@playwright/test";

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/catalog");
  }

  async searchFor(query: string): Promise<void> {
    await this.page.getByLabel("Search books").fill(query);
    await this.page.getByRole("button", { name: "Search" }).click();
  }

  async addBook(title: string, author: string): Promise<void> {
    const bookRow = this.page.getByRole("listitem").filter({ hasText: `${title} ${author}` });
    await bookRow.getByRole("button", { name: `Add ${title}` }).click();
  }

  getMarkAsReadingButton(title: string): Locator {
    return this.page.getByRole("button", { name: `Mark ${title} as reading` });
  }

  getBookListItem(title: string): Locator {
    return this.page.getByRole("listitem").filter({ hasText: title });
  }

  async markBookAsReading(title: string): Promise<void> {
    await this.getMarkAsReadingButton(title).click();
  }
}
