import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BookListComponent } from './book-list';

describe('BookListComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders no items when the API returns an empty list', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    httpTesting.expectOne('/api/books').flush([]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items).toHaveLength(0);
  });

  it('renders title and author for each book', () => {
    const fixture = TestBed.createComponent(BookListComponent);

    const mockBooks = [
      { id: 'id-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
      { id: 'id-2', title: 'Foundation', authors: [{ id: 'auth-2', name: 'Isaac Asimov' }] },
    ];
    httpTesting.expectOne('/api/books').flush(mockBooks);

    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items).toHaveLength(mockBooks.length);
    expect(items[0].textContent).toContain(mockBooks[0].title);
    expect(items[0].textContent).toContain(mockBooks[0].authors[0].name);
    expect(items[1].textContent).toContain(mockBooks[1].title);
    expect(items[1].textContent).toContain(mockBooks[1].authors[0].name);
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

    const item = fixture.nativeElement.querySelector('li');
    expect(item.textContent).toContain('Terry Pratchett, Neil Gaiman');
  });
});
