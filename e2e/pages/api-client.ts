import { APIRequestContext } from '@playwright/test';

const BACKEND_URL = 'http://127.0.0.1:8000';

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createBook(title: string, author: string): Promise<string> {
    const response = await this.request.post(`${BACKEND_URL}/books`, {
      data: { title, author },
    });
    const body = await response.json();
    return body.id as string;
  }

  async markAsReading(bookId: string): Promise<string> {
    const response = await this.request.post(`${BACKEND_URL}/engagements`, {
      data: { book_id: bookId },
    });
    const body = await response.json();
    return body.id as string;
  }

  async markAsFinished(engagementId: string): Promise<void> {
    await this.request.patch(`${BACKEND_URL}/engagements/${engagementId}`, {
      data: { status: 'finished' },
    });
  }
}
