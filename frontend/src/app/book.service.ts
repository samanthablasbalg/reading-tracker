import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, shareReplay, startWith, switchMap } from 'rxjs';
import { environment } from '../environments/environment';

export interface Author {
  id: string;
  name: string;
}

export interface Book {
  id: string;
  title: string;
  authors: Author[];
  google_books_id: string | null;
  default_cover_url: string | null;
  default_page_count: number | null;
  default_audio_minutes: number | null;
  original_language: string | null;
  genres: string[];
  publication_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookSearchCandidate {
  google_books_id: string;
  title: string;
  authors: string[];
  published_date: string | null;
  page_count: number | null;
  categories: string[];
  cover_url: string | null;
  language: string | null;
}

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly reloadTrigger = new Subject<void>();

  readonly books$: Observable<Book[]> = this.reloadTrigger.pipe(
    startWith(undefined),
    switchMap(() => this.http.get<Book[]>(`${environment.apiBaseUrl}/books`)),
    shareReplay(1),
  );

  reloadBooks(): void {
    this.reloadTrigger.next();
  }

  searchBooks(q: string): Observable<BookSearchCandidate[]> {
    return this.http.get<BookSearchCandidate[]>(`${environment.apiBaseUrl}/books/search`, {
      params: { q },
    });
  }

  importBook(googleBooksId: string): Observable<Book> {
    return this.http.post<Book>(`${environment.apiBaseUrl}/books/import`, {
      google_books_id: googleBooksId,
    });
  }

  deleteBook(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/books/${id}`);
  }
}
