import { Component } from '@angular/core';
import { BookListComponent } from './book-list/book-list';

@Component({
  selector: 'app-root',
  imports: [BookListComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
