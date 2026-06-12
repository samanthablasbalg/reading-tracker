import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BookSearchCandidate, BookService } from '../book.service';

@Component({
  selector: 'app-book-search',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, ReactiveFormsModule],
  template: `
    <section>
      <mat-form-field>
        <mat-label>Search books</mat-label>
        <input matInput [formControl]="queryControl" (keydown.enter)="search()" />
      </mat-form-field>
      <button mat-flat-button (click)="search()" [disabled]="isSearching()">Search</button>

      @if (isSearching()) {
        <p>Searching…</p>
      }
      @if (searchError()) {
        <p role="alert">Search failed — please try again.</p>
      }

      <ul>
        @for (candidate of candidates(); track candidate.google_books_id) {
          <li>
            @if (candidate.cover_url) {
              <img
                [src]="candidate.cover_url.replace('http://', 'https://')"
                [alt]="candidate.title + ' cover'"
                width="48"
                height="64"
              />
            }
            <div>
              <strong>{{ candidate.title }}</strong>
              <span>{{ candidate.authors.join(', ') }}</span>
              @if (candidate.published_date) {
                <span>{{ candidate.published_date.slice(0, 4) }}</span>
              }
            </div>
            <button
              mat-stroked-button
              [attr.aria-label]="'Add ' + candidate.title"
              [disabled]="importingId() === candidate.google_books_id"
              (click)="addBook(candidate)"
            >
              {{ importingId() === candidate.google_books_id ? 'Adding…' : 'Add' }}
            </button>
            @if (importErrorId() === candidate.google_books_id) {
              <p role="alert">Could not import this book — please try again.</p>
            }
          </li>
        }
      </ul>
    </section>
  `,
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
