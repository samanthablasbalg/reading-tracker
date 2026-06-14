import { Component } from '@angular/core';
import { BookSearchComponent } from '../book-search/book-search';
import { BookListComponent } from '../book-list/book-list';

@Component({
  selector: 'app-catalog',
  imports: [BookSearchComponent, BookListComponent],
  template: `<app-book-search /><app-book-list />`,
})
export class CatalogComponent {}
