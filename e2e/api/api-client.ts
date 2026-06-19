import { APIRequestContext } from '@playwright/test';

// The e2e backend runs on :8001 (dev is on :8000). This client seeds data by
// calling the API directly, bypassing the frontend proxy, so it needs the port.
const BACKEND_URL = 'http://127.0.0.1:8001';

export class ApiClient {
  /** @param request - Playwright's request context, used to call the backend. */
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Creates a book directly via the backend, inferring the author by name.
   * @param title - The book's title.
   * @param author - The author's name; created if it doesn't exist.
   * @returns The new book's id.
   */
  async createBook(title: string, author: string): Promise<string> {
    const response = await this.request.post(`${BACKEND_URL}/books`, {
      data: { title, author },
    });
    const { id } = (await response.json()) as { id: string };
    return id;
  }
}
