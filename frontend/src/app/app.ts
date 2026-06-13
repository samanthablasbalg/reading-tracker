import { Component } from '@angular/core';
import { BookListComponent } from './book-list/book-list';
import { BookSearchComponent } from './book-search/book-search';

@Component({
  selector: 'app-root',
  imports: [BookListComponent, BookSearchComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
