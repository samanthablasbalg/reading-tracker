import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BookListComponent } from './book-list';
import { FormatPickSheetComponent } from '../format-pick-sheet/format-pick-sheet';

const mockBook = {
  id: 'book-1',
  title: 'Dune',
  authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
  default_cover_url: 'https://example.com/dune.jpg',
  default_page_count: 412,
  default_audio_minutes: null as number | null,
};

describe('BookListComponent', () => {
  let httpTesting: HttpTestingController;
  let bottomSheet: MatBottomSheet;
  let dialog: MatDialog;
  let breakpointObserver: BreakpointObserver;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    bottomSheet = TestBed.inject(MatBottomSheet);
    dialog = TestBed.inject(MatDialog);
    breakpointObserver = TestBed.inject(BreakpointObserver);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders no items when the API returns an empty list', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('mat-list-item')).toHaveLength(0);
  });

  it('renders title and author for each book', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    const mockBooks = [
      { id: 'id-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
      { id: 'id-2', title: 'Foundation', authors: [{ id: 'auth-2', name: 'Isaac Asimov' }] },
    ];
    httpTesting.expectOne('/api/books').flush(mockBooks);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Dune');
    expect(items[0].textContent).toContain('Frank Herbert');
    expect(items[1].textContent).toContain('Foundation');
    expect(items[1].textContent).toContain('Isaac Asimov');
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([
      {
        id: 'id-1',
        title: 'Good Omens',
        authors: [
          { id: 'auth-1', name: 'Terry Pratchett' },
          { id: 'auth-2', name: 'Neil Gaiman' },
        ],
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
    );
  });

  it('renders a Mark as reading button per book', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button[mat-stroked-button]');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Mark as reading');
  });

  it('opens the bottom sheet with book data on mobile', () => {
    vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(true);
    vi.spyOn(bottomSheet, 'open');

    const fixture = TestBed.createComponent(BookListComponent);
    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();

    expect(bottomSheet.open).toHaveBeenCalledWith(FormatPickSheetComponent, {
      data: {
        bookId: 'book-1',
        title: 'Dune',
        cover_url: 'https://example.com/dune.jpg',
        default_audio_minutes: null,
      },
    });
  });

  it('opens a dialog with book data on desktop', () => {
    vi.spyOn(breakpointObserver, 'isMatched').mockReturnValue(false);
    vi.spyOn(dialog, 'open');

    const fixture = TestBed.createComponent(BookListComponent);
    httpTesting.expectOne('/api/books').flush([mockBook]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[mat-stroked-button]').click();

    expect(dialog.open).toHaveBeenCalledWith(FormatPickSheetComponent, {
      data: {
        bookId: 'book-1',
        title: 'Dune',
        cover_url: 'https://example.com/dune.jpg',
        default_audio_minutes: null,
      },
    });
  });

  describe('book deletion', () => {
    it('declining the confirm dialog sends no request', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fixture = TestBed.createComponent(BookListComponent);
      httpTesting.expectOne('/api/books').flush([mockBook]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      httpTesting.expectNone('/api/books/book-1');
    });

    it('confirming calls DELETE then reloads the book list', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(BookListComponent);
      httpTesting.expectOne('/api/books').flush([mockBook]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/books/book-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      httpTesting.expectOne('/api/books').flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('mat-list-item')).toHaveLength(0);
    });

    it('shows a 409 error under the book row when deletion is rejected', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(BookListComponent);
      httpTesting.expectOne('/api/books').flush([mockBook]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete Dune"]').click();
      fixture.detectChanges();

      httpTesting
        .expectOne('/api/books/book-1')
        .flush(
          { detail: 'Remove its engagements first.' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
        'Remove its engagements first.',
      );
    });
  });
});
