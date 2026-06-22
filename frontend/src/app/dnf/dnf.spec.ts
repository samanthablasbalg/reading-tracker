import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DNFComponent } from './dnf';

const mockDnf = {
  id: 'eng-1',
  book: {
    id: 'book-1',
    title: 'Dune',
    authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
    default_page_count: null as number | null,
  },
  formats: [] as string[],
  cover_url: null as string | null,
  status: 'dnf',
  started_on: '2026-01-01',
  finished_on: null as string | null,
  abandoned_on: '2026-03-15',
  resume_from_page: 120,
  completion_pct: 43 as number | null,
};

describe('DNFComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DNFComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushDnfList(data: unknown[] = [mockDnf]) {
    httpTesting
      .expectOne((req) => req.url === '/api/engagements' && req.params.get('status') === 'dnf')
      .flush(data);
  }

  it('shows empty state when there are no DNFed books', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No DNFed books yet');
  });

  it('renders title and authors for each DNFed book', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList([
      {
        ...mockDnf,
        book: {
          ...mockDnf.book,
          authors: [
            { id: 'auth-1', name: 'Terry Pratchett' },
            { id: 'auth-2', name: 'Neil Gaiman' },
          ],
        },
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).toContain(
      'Terry Pratchett, Neil Gaiman',
    );
  });

  it('renders the give-up date', () => {
    const fixture = TestBed.createComponent(DNFComponent);

    flushDnfList();
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('mat-list-item').textContent;
    expect(text).toContain('Gave up on');
    expect(text).toContain('Mar 15, 2026');
  });
});
