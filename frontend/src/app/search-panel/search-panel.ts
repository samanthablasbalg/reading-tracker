import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { SearchResultRowComponent } from '../search-result-row/search-result-row';
import { BookSearchResult, BookService } from '../book.service';

@Component({
  selector: 'app-search-panel',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    SearchResultRowComponent,
  ],
  templateUrl: './search-panel.html',
  // MatMenu's panel root closes the menu on any click that bubbles up through its
  // projected content (see node_modules/@angular/material/fesm2022/menu.mjs) - it assumes
  // everything inside is a mat-menu-item. Stop the click here so interacting with the
  // search input/results doesn't close the whole menu.
  host: { '(click)': '$event.stopPropagation()' },
})
export class SearchPanelComponent {
  private readonly bookService = inject(BookService);

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  protected readonly results = signal<BookSearchResult[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly searchError = signal(false);
  protected readonly searched = signal(false);

  protected search(): void {
    if (this.isSearching()) return;
    const q = this.queryControl.value.trim();
    if (!q) return;

    this.isSearching.set(true);
    this.searchError.set(false);
    this.results.set([]);

    this.bookService.searchBooks(q).subscribe({
      next: (results) => {
        this.results.set(results);
        this.isSearching.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.searchError.set(true);
        this.isSearching.set(false);
        this.searched.set(true);
      },
    });
  }
}
