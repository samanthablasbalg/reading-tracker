import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { BookService } from '../book.service';

@Component({
  selector: 'app-book-list',
  imports: [MatListModule],
  template: `
    <mat-list>
      @for (book of books(); track book.id) {
        <mat-list-item>
          <span matListItemTitle>{{ book.title }}</span>
          <span matListItemLine>{{ book.authors.map((a) => a.name).join(', ') }}</span>
        </mat-list-item>
      }
    </mat-list>
  `,
})
export class BookListComponent {
  private readonly bookService = inject(BookService);
  protected readonly books = toSignal(this.bookService.books$, { initialValue: [] });
}
