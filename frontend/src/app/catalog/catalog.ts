import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BookSearchComponent } from '../book-search/book-search';
import { BookListComponent } from '../book-list/book-list';

@Component({
  selector: 'app-catalog',
  imports: [BookSearchComponent, BookListComponent, RouterLink, RouterLinkActive],
  styles: [
    `
      .shelves {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 12px 16px 14px;
        scrollbar-width: none;
      }

      .shelves::-webkit-scrollbar {
        display: none;
      }

      .shelf {
        flex: none;
        font-family: var(--font-sans);
        font-size: 12.5px;
        font-weight: 700;
        text-decoration: none;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--color-surface);
        color: var(--color-muted);
      }

      .shelf.active {
        background: var(--color-primary);
        color: var(--color-on-primary);
      }
    `,
  ],
  template: `
    <nav class="shelves" aria-label="Shelves">
      <a class="shelf active" aria-current="page">All books</a>
      <a class="shelf" routerLink="/finished" routerLinkActive="active">Finished</a>
      <a class="shelf" routerLink="/dnf" routerLinkActive="active">DNF</a>
    </nav>
    <app-book-search />
    <app-book-list />
  `,
})
export class CatalogComponent {}
