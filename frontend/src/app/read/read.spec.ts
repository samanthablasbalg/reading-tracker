import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReadComponent } from './read';

const mockEngagement = {
  id: 'eng-1',
  book: { id: 'book-1', title: 'Dune', authors: [{ id: 'auth-1', name: 'Frank Herbert' }] },
  formats: [] as string[],
  status: 'finished',
  started_on: '2026-05-01',
  finished_on: '2026-06-01' as string | null,
};

describe('ReadComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushFinishedList(data = [mockEngagement]) {
    httpTesting
      .expectOne((req) => req.url === '/api/engagements' && req.params.get('status') === 'finished')
      .flush(data);
  }

  it('shows empty state when there are no finished books', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No finished books yet');
  });

  it('renders title, authors, and finish date for each engagement', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mat-list-item');
    expect(item.textContent).toContain('Dune');
    expect(item.textContent).toContain('Frank Herbert');
    expect(item.textContent).toContain('Finished');
    expect(item.textContent).toContain('Jun 1, 2026');
  });

  it('omits the finished line when finished_on is null', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([{ ...mockEngagement, finished_on: null }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-list-item').textContent).not.toContain(
      'Finished',
    );
  });

  describe('format icon', () => {
    it('renders menu_book for a print engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['print'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon).toBeTruthy();
      expect(icon.textContent.trim()).toBe('menu_book');
      expect(icon.getAttribute('aria-label')).toBe('Format: print');
    });

    it('renders tablet_mac for a digital engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['digital'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('tablet_mac');
      expect(icon.getAttribute('aria-label')).toBe('Format: digital');
    });

    it('renders headphones for an audio engagement', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: ['audio'] }]);
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('headphones');
      expect(icon.getAttribute('aria-label')).toBe('Format: audio');
    });

    it('renders no icon when formats is empty', () => {
      const fixture = TestBed.createComponent(ReadComponent);

      flushFinishedList([{ ...mockEngagement, formats: [] }]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-icon')).toBeNull();
    });
  });

  it('joins multiple authors with a comma', () => {
    const fixture = TestBed.createComponent(ReadComponent);

    flushFinishedList([
      {
        ...mockEngagement,
        book: {
          id: 'book-1',
          title: 'Good Omens',
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
});
