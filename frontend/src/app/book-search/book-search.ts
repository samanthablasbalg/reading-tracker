import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { BookSearchCandidate, BookService } from '../book.service';

@Component({
  selector: 'app-book-search',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  styles: `
    .search-form {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    mat-form-field {
      width: 320px;
    }
  `,
  template: `
    <section>
      <div class="search-form">
        <mat-form-field>
          <mat-label>Search books</mat-label>
          <input matInput [formControl]="queryControl" (keydown.enter)="search()" />
        </mat-form-field>
        <button mat-flat-button (click)="search()" [disabled]="isSearching()">Search</button>
      </div>

      @if (isSearching()) {
        <p>Searching…</p>
      }
      @if (searchError()) {
        <p role="alert">Search failed — please try again.</p>
      }

      @if (candidates().length > 0) {
        <table mat-table [dataSource]="candidates()">
          <ng-container matColumnDef="cover">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let candidate">
              @if (candidate.cover_url) {
                <img
                  [src]="candidate.cover_url.replace('http://', 'https://')"
                  [alt]="candidate.title + ' cover'"
                  width="48"
                  height="64"
                />
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef>Title</th>
            <td mat-cell *matCellDef="let candidate">
              <strong>{{ candidate.title }}</strong
              ><br />
              <span>{{ candidate.authors.join(', ') }}</span
              ><br />
              @if (candidate.published_date) {
                <span>{{ candidate.published_date.slice(0, 4) }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let candidate">
              <button
                mat-stroked-button
                [attr.aria-label]="'Add ' + candidate.title"
                [disabled]="
                  importingId() === candidate.google_books_id ||
                  importedIds().has(candidate.google_books_id)
                "
                (click)="addBook(candidate)"
              >
                {{ addButtonLabel(candidate.google_books_id) }}
              </button>
              @if (importErrorId() === candidate.google_books_id) {
                <p role="alert">Could not import this book — please try again.</p>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      }
    </section>
  `,
})
export class BookSearchComponent {
  private readonly bookService = inject(BookService);

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  protected readonly columns = ['cover', 'details', 'actions'];

  protected readonly candidates = signal<BookSearchCandidate[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly searchError = signal(false);
  protected readonly importingId = signal<string | null>(null);
  protected readonly importErrorId = signal<string | null>(null);
  protected readonly importedIds = signal(new Set<string>());

  protected addButtonLabel(googleBooksId: string): string {
    if (this.importingId() === googleBooksId) return 'Adding…';
    if (this.importedIds().has(googleBooksId)) return 'Added';
    return 'Add';
  }

  protected addBook(candidate: BookSearchCandidate): void {
    this.importingId.set(candidate.google_books_id);
    this.importErrorId.set(null);

    this.bookService.importBook(candidate.google_books_id).subscribe({
      next: () => {
        this.importedIds.update((ids) => new Set([...ids, candidate.google_books_id]));
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
    if (this.isSearching()) return;
    const q = this.queryControl.value.trim();
    if (!q) return;

    this.isSearching.set(true);
    this.searchError.set(false);
    this.candidates.set([]);
    this.importingId.set(null);
    this.importErrorId.set(null);
    this.importedIds.set(new Set());

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
