import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BookService } from '../book.service';

@Component({
  selector: 'app-book-list',
  template: `
    <ul>
      @for (book of books(); track book.id) {
        <li>{{ book.title }} — {{ book.authors.map((a) => a.name).join(', ') }}</li>
      }
    </ul>
  `,
})
export class BookListComponent {
  private readonly bookService = inject(BookService);
  protected readonly books = toSignal(this.bookService.books$, { initialValue: [] });
}
