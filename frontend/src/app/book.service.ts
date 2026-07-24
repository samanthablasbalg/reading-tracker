import { inject, Injectable } from '@angular/core';
import { Observable, Subject, shareReplay, startWith, switchMap } from 'rxjs';
import { BooksService as BooksApiService } from './api/generated/books/books.service';
import type { BookRead, BookSearchResult } from './api/generated/readingTracker.schemas';

export type {
  AuthorRead as Author,
  BookRead as Book,
  BookSearchResult,
} from './api/generated/readingTracker.schemas';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly booksApi = inject(BooksApiService);
  private readonly reloadTrigger = new Subject<void>();

  readonly books$: Observable<BookRead[]> = this.reloadTrigger.pipe(
    startWith(undefined),
    switchMap(() => this.booksApi.booksListBooks()),
    shareReplay(1),
  );

  reloadBooks(): void {
    this.reloadTrigger.next();
  }

  searchBooks(q: string): Observable<BookSearchResult[]> {
    return this.booksApi.booksSearchBooks({ q });
  }

  importBook(googleBooksId: string): Observable<BookRead> {
    return this.booksApi.booksImportBook({ google_books_id: googleBooksId });
  }

  deleteBook(id: string): Observable<void> {
    return this.booksApi.booksDeleteBook(id);
  }
}
