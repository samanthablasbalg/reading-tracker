import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProgressLogSheetComponent, ProgressLogSheetData } from './progress-log-sheet';
import { EngagementService } from '../engagement.service';

const baseData: ProgressLogSheetData = {
  engagementId: 'eng-1',
  title: 'Dune',
  cover_url: null,
  resume_from_page: 50,
  default_page_count: 412,
};

describe('ProgressLogSheetComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockEngagementService: Pick<EngagementService, 'logProgress' | 'reloadEngagements'>;

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    mockEngagementService = {
      logProgress: vi.fn(() => of({})),
      reloadEngagements: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProgressLogSheetComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: baseData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: EngagementService, useValue: mockEngagementService },
      ],
    }).compileComponents();
  });

  function createFixture(dataOverrides: Partial<ProgressLogSheetData> = {}) {
    if (Object.keys(dataOverrides).length) {
      TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { ...baseData, ...dataOverrides } });
    }
    const fixture = TestBed.createComponent(ProgressLogSheetComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the book title', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.textContent).toContain('Dune');
  });

  it('does not render an image when cover_url is null', () => {
    const fixture = createFixture();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('renders a cover image when cover_url is set', () => {
    const fixture = createFixture({ cover_url: 'https://example.com/cover.jpg' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.com/cover.jpg');
    expect(img.getAttribute('alt')).toBe('Dune cover');
  });

  it('pre-fills the page input with resume_from_page', () => {
    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('50');
  });

  it('save calls logProgress with the engagement id and entered page', () => {
    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(mockEngagementService.logProgress).toHaveBeenCalledWith('eng-1', 100);
  });

  it('calls reloadEngagements and closes on save success', () => {
    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(mockEngagementService.reloadEngagements).toHaveBeenCalledOnce();
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('shows Saving… and disables the button while the request is in flight', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    mockEngagementService.logProgress = vi.fn(
      () =>
        new Observable((sub) => {
          promise.then(() => sub.next({}));
        }),
    );

    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Saving…');
    expect(button.disabled).toBe(true);

    resolve();
  });

  it('shows an inline error and keeps the sheet open on save failure', () => {
    mockEngagementService.logProgress = vi.fn(() => throwError(() => new Error('server error')));

    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Failed to save',
    );
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('preserves the page input value after a save failure', () => {
    mockEngagementService.logProgress = vi.fn(() => throwError(() => new Error()));

    const fixture = createFixture();
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(input.value).toBe('100');
  });

  it('disables Save and does not submit when page exceeds page count', () => {
    const fixture = createFixture({ default_page_count: 300 });
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '400';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });

  it('saves when page equals the page count', () => {
    const fixture = createFixture({ default_page_count: 300 });
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '300';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(mockEngagementService.logProgress).toHaveBeenCalledWith('eng-1', 300);
  });

  it('does not submit when page count is unknown and no page is entered', () => {
    const fixture = createFixture({ default_page_count: null, resume_from_page: 0 });
    const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });
});
