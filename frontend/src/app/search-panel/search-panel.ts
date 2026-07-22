import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { SearchResultRowComponent } from '../search-result-row/search-result-row';
import { BookSearchResult, BookService } from '../book.service';
import { EngagementStatus } from '../engagement.service';
import {
  FormatPickSheetComponent,
  FormatPickSheetData,
} from '../format-pick-sheet/format-pick-sheet';

const ADD_STATUSES: EngagementStatus[] = ['reading', 'finished', 'dnf'];
const MOBILE_BREAKPOINT = '(max-width: 599px)';

interface ResultGroup {
  heading: string;
  hint: string | null;
  results: BookSearchResult[];
}

const GROUP_DEFINITIONS: {
  heading: string;
  hint: string | null;
  state: BookSearchResult['state'];
}[] = [
  { heading: 'In your library', hint: null, state: 'in_library' },
  { heading: 'Already in the app', hint: '· add to your library', state: 'in_catalog' },
  { heading: 'New — from Google Books', hint: '· import into the app', state: 'not_in_app' },
];

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
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly queryControl = new FormControl('', { nonNullable: true });
  protected readonly results = signal<BookSearchResult[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly searchError = signal(false);
  protected readonly searched = signal(false);
  protected readonly importingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly importError = signal<string | null>(null);

  protected readonly groups = computed<ResultGroup[]>(() => {
    const results = this.results();
    return GROUP_DEFINITIONS.map(({ heading, hint, state }) => ({
      heading,
      hint,
      results: results.filter((r) => r.state === state),
    })).filter((group) => group.results.length > 0);
  });

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

  protected onImport(result: BookSearchResult): void {
    const googleBooksId = result.google_books_id!;
    this.importError.set(null);
    this.importingIds.update((ids) => new Set(ids).add(googleBooksId));

    this.bookService.importBook(googleBooksId).subscribe({
      next: (book) => {
        this.importingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(googleBooksId);
          return next;
        });
        this.results.update((results) =>
          results.map((r) =>
            r.google_books_id === googleBooksId
              ? { ...r, state: 'in_catalog', book_id: book.id }
              : r,
          ),
        );
        this.openAddSheet(
          {
            bookId: book.id,
            title: book.title,
            cover_url: book.default_cover_url,
            default_audio_minutes: book.default_audio_minutes,
            statuses: ADD_STATUSES,
            cancelLabel: 'No thanks — just import',
          },
          book.id,
        );
      },
      error: () => {
        this.importingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(googleBooksId);
          return next;
        });
        this.importError.set('Import failed — please try again.');
      },
    });
  }

  protected onAdd(result: BookSearchResult): void {
    this.openAddSheet(
      {
        bookId: result.book_id!,
        title: result.title,
        cover_url: result.cover_url,
        default_audio_minutes: null,
        statuses: ADD_STATUSES,
      },
      result.book_id!,
    );
  }

  private openAddSheet(data: FormatPickSheetData, bookId: string): void {
    const onClosed = (status: EngagementStatus | undefined) => {
      if (!status) return;
      this.results.update((results) =>
        results.map((r) => (r.book_id === bookId ? { ...r, state: 'in_library', status } : r)),
      );
    };

    if (this.breakpointObserver.isMatched(MOBILE_BREAKPOINT)) {
      this.bottomSheet
        .open<
          FormatPickSheetComponent,
          FormatPickSheetData,
          EngagementStatus
        >(FormatPickSheetComponent, { data })
        .afterDismissed()
        .subscribe(onClosed);
    } else {
      this.dialog
        .open<
          FormatPickSheetComponent,
          FormatPickSheetData,
          EngagementStatus
        >(FormatPickSheetComponent, { data })
        .afterClosed()
        .subscribe(onClosed);
    }
  }
}
