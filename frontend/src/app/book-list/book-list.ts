import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { BookService } from '../book.service';
import { EngagementService } from '../engagement.service';

@Component({
  selector: 'app-book-list',
  imports: [MatListModule, MatButtonModule],
  template: `
    <mat-list>
      @for (book of books(); track book.id) {
        <mat-list-item>
          <span matListItemTitle>{{ book.title }}</span>
          <span matListItemLine>{{ book.authors.map((a) => a.name).join(', ') }}</span>
          <button
            mat-stroked-button
            matListItemMeta
            [disabled]="markingId() === book.id"
            [attr.aria-label]="'Mark ' + book.title + ' as reading'"
            (click)="markReading(book.id)"
          >
            {{ markButtonLabel(book.id) }}
          </button>
        </mat-list-item>
      }
    </mat-list>
  `,
})
export class BookListComponent {
  private readonly bookService = inject(BookService);
  private readonly engagementService = inject(EngagementService);

  protected readonly books = toSignal(this.bookService.books$, { initialValue: [] });
  protected readonly markingId = signal<string | null>(null);
  protected readonly markErrorId = signal<string | null>(null);
  protected readonly markErrorStatus = signal<number | null>(null);

  protected markButtonLabel(bookId: string): string {
    if (this.markingId() === bookId) return 'Marking…';
    if (this.markErrorId() === bookId) {
      return this.markErrorStatus() === 409 ? 'Already reading' : 'Error';
    }
    return 'Mark as reading';
  }

  protected markReading(bookId: string): void {
    this.markingId.set(bookId);
    this.markErrorId.set(null);
    this.markErrorStatus.set(null);

    this.engagementService.markReading(bookId).subscribe({
      next: () => {
        this.markingId.set(null);
        this.engagementService.reloadEngagements();
      },
      error: (err: HttpErrorResponse) => {
        this.markingId.set(null);
        this.markErrorId.set(bookId);
        this.markErrorStatus.set(err.status);
      },
    });
  }
}
