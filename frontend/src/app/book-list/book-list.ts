import { Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Book, BookService } from '../book.service';
import {
  FormatPickSheetComponent,
  FormatPickSheetData,
} from '../format-pick-sheet/format-pick-sheet';

@Component({
  selector: 'app-book-list',
  imports: [NgOptimizedImage, MatListModule, MatButtonModule, MatDivider],
  template: `
    <mat-list>
      @for (book of books(); track book.id) {
        <mat-list-item>
          @if (book.default_cover_url) {
            <img
              matListItemAvatar
              [ngSrc]="book.default_cover_url"
              width="40"
              height="40"
              [alt]="book.title + ' cover'"
            />
          }
          <span matListItemTitle>{{ book.title }}</span>
          <span matListItemLine>{{ book.authors.map((a) => a.name).join(', ') }}</span>
          <button
            mat-stroked-button
            matListItemMeta
            [attr.aria-label]="'Mark ' + book.title + ' as reading'"
            (click)="openFormatPicker(book)"
          >
            Mark as reading
          </button>
        </mat-list-item>
        @if (!$last) {
          <mat-divider />
        }
      }
    </mat-list>
  `,
})
export class BookListComponent {
  private readonly bookService = inject(BookService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly books = toSignal(this.bookService.books$, { initialValue: [] });

  protected openFormatPicker(book: Book): void {
    const data: FormatPickSheetData = {
      bookId: book.id,
      title: book.title,
      cover_url: book.default_cover_url,
      default_audio_minutes: book.default_audio_minutes,
    };

    if (this.breakpointObserver.isMatched('(max-width: 599px)')) {
      this.bottomSheet.open(FormatPickSheetComponent, { data });
    } else {
      this.dialog.open(FormatPickSheetComponent, { data });
    }
  }
}
