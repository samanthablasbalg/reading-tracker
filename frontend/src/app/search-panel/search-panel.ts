import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    SearchResultRowComponent,
  ],
  templateUrl: './search-panel.html',
  // Desktop: this component IS the collapsed-icon <-> expanded-bar toggle, so it needs to see
  // clicks/Escape anywhere on the page to know when to collapse - mobile ignores both (the
  // dialog's own backdrop/Escape handling and the explicit close button cover it there).
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class SearchPanelComponent {
  private readonly bookService = inject(BookService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  // Only set when nav-shell opens this as a full-screen MatDialog (mobile) - not when it's
  // placed inline in the header (desktop), which has no dialog chrome around it. Doubles as
  // the signal for which template branch to render (see search-panel.html).
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  protected readonly isFullScreen = !!this.dialogRef;

  // #toggleButton sits on a mat-icon-button, so a bare ref would resolve to the MatIconButton
  // directive instance (not the element) - `read: ElementRef` forces the native element.
  private readonly toggleButton = viewChild<unknown, ElementRef<HTMLButtonElement>>(
    'toggleButton',
    { read: ElementRef },
  );
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly isOpen = signal(false);
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

  // Gates the results dropdown itself (see search-panel.html) - without this it renders as an
  // empty card the instant the bar opens, before a search has ever run.
  protected readonly hasContent = computed(
    () =>
      this.isSearching() ||
      this.searchError() ||
      this.importError() !== null ||
      this.searched() ||
      this.results().length > 0,
  );

  protected close(): void {
    this.dialogRef?.close();
  }

  protected toggleOpen(): void {
    if (this.isOpen()) {
      this.collapse();
      return;
    }
    this.isOpen.set(true);
    this.searchInput()?.nativeElement.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.isFullScreen || !this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.collapse();
    }
  }

  protected onEscape(): void {
    if (this.isFullScreen || !this.isOpen()) return;
    this.collapse();
  }

  private collapse(): void {
    this.isOpen.set(false);
    this.resetSearch();
    this.toggleButton()?.nativeElement.focus();
  }

  private resetSearch(): void {
    this.queryControl.reset('');
    this.results.set([]);
    this.isSearching.set(false);
    this.searchError.set(false);
    this.searched.set(false);
    this.importingIds.set(new Set());
    this.importError.set(null);
  }

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
        // The row itself doesn't change yet - only once the sheet below closes - so nothing
        // visibly shifts in the list behind an open sheet/dialog while the user is mid-workflow.
        this.openAddSheet(
          {
            bookId: book.id,
            title: book.title,
            cover_url: book.default_cover_url,
            default_audio_minutes: book.default_audio_minutes,
            statuses: ADD_STATUSES,
            cancelLabel: 'No thanks — just import',
          },
          (status) => {
            this.results.update((results) =>
              results.map((r) =>
                r.google_books_id === googleBooksId
                  ? {
                      ...r,
                      book_id: book.id,
                      state: status ? 'in_library' : 'in_catalog',
                      status: status ?? null,
                    }
                  : r,
              ),
            );
          },
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
    const bookId = result.book_id!;
    this.openAddSheet(
      {
        bookId,
        title: result.title,
        cover_url: result.cover_url,
        default_audio_minutes: null,
        statuses: ADD_STATUSES,
      },
      (status) => {
        if (!status) return;
        this.results.update((results) =>
          results.map((r) => (r.book_id === bookId ? { ...r, state: 'in_library', status } : r)),
        );
      },
    );
  }

  private openAddSheet(
    data: FormatPickSheetData,
    onWorkflowDone: (status: EngagementStatus | undefined) => void,
  ): void {
    const onClosed = (status: EngagementStatus | undefined) => {
      // Reload only once the whole workflow is done (whatever the user chose) - reloading
      // mid-workflow would visibly change the Catalog list behind an open sheet/dialog.
      this.bookService.reloadBooks();
      onWorkflowDone(status);
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
