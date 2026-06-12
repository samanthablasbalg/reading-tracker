import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BookSearchCandidate, BookService } from '../book.service';

@Component({
  selector: 'app-book-search',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  template: `<p>Search coming soon</p>`,
})
export class BookSearchComponent {
  private readonly bookService = inject(BookService);

  protected readonly queryControl = new FormControl('', { nonNullable: true });

  protected readonly candidates = signal<BookSearchCandidate[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly searchError = signal(false);
  protected readonly importingId = signal<string | null>(null);
  protected readonly importErrorId = signal<string | null>(null);

  protected addBook(candidate: BookSearchCandidate): void {
    this.importingId.set(candidate.google_books_id);
    this.importErrorId.set(null);

    this.bookService.importBook(candidate.google_books_id).subscribe({
      next: () => {
        this.importingId.set(null);
        this.bookService.reloadBooks();
      },
      error: () => {
        this.importingId.set(null);
        this.importErrorId.set(candidate.google_books_id);
      },
    });
  }

  protected search(): void {
    const q = this.queryControl.value.trim();
    if (!q) return;

    this.isSearching.set(true);
    this.searchError.set(false);
    this.candidates.set([]);

    this.bookService.searchBooks(q).subscribe({
      next: (results) => {
        this.candidates.set(results);
        this.isSearching.set(false);
      },
      error: () => {
        this.searchError.set(true);
        this.isSearching.set(false);
      },
    });
  }
}
