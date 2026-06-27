import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { EngagementHistoryComponent } from './engagement-history';
import { Engagement, ProgressLog } from '../engagement.service';

const mockEngagement: Engagement = {
  id: 'eng-1',
  book: {
    id: 'book-1',
    title: 'Dune',
    authors: [{ id: 'auth-1', name: 'Frank Herbert' }],
    default_page_count: 412,
    default_audio_minutes: 0,
  },
  formats: ['print'],
  cover_url: null,
  status: 'reading',
  started_on: '2026-01-01',
  finished_on: '2026-06-15',
  abandoned_on: null,
  resume_from_page: 0,
  resume_from_minute: 0,
  completion_pct: null,
  review: null,
};

const mockLogs: ProgressLog[] = [
  {
    id: 'log-1',
    engagement_id: 'eng-1',
    logged_at: '2026-01-01',
    unit: 'pages',
    page_start: 1,
    page_end: 50,
    minute_start: null,
    minute_end: null,
    new_ground: true,
  },
  {
    id: 'log-2',
    engagement_id: 'eng-1',
    logged_at: '2026-01-10',
    unit: 'pages',
    page_start: 51,
    page_end: 100,
    minute_start: null,
    minute_end: null,
    new_ground: true,
  },
];

describe('EngagementHistoryComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EngagementHistoryComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'eng-1' })) },
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushLoad(engagement = mockEngagement, logs = mockLogs) {
    httpTesting.expectOne('/api/engagements/eng-1').flush(engagement);
    httpTesting.expectOne('/api/engagements/eng-1/progress-logs').flush(logs);
  }

  it('renders engagement title, author, and all log ranges', () => {
    const fixture = TestBed.createComponent(EngagementHistoryComponent);
    flushLoad();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dune');
    expect(text).toContain('Frank Herbert');
    expect(text).toContain('pp. 1–50');
    expect(text).toContain('pp. 51–100');
  });

  it('shows the new badge on logs with new_ground true', () => {
    const fixture = TestBed.createComponent(EngagementHistoryComponent);
    flushLoad();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.new-badge').length).toBe(2);
  });

  it('shows empty state when there are no logs', () => {
    const fixture = TestBed.createComponent(EngagementHistoryComponent);
    flushLoad(mockEngagement, []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No progress logged yet');
  });

  describe('date editing', () => {
    it('clicking a date button shows a date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const dateBtn = fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]');
      dateBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeTruthy();
    });

    it('blur on the date input calls PATCH with logged_at then refreshes', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
      input.value = '2026-02-01';
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs/log-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ logged_at: '2026-02-01' });
      req.flush({ ...mockLogs[0], logged_at: '2026-02-01' });

      flushLoad();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();
    });

    it('pressing Escape on the date input cancels without a PATCH', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();
    });

    it('shows the 409 error message under the date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
      input.value = '2026-02-01';
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      httpTesting
        .expectOne('/api/engagements/eng-1/progress-logs/log-1')
        .flush(
          { detail: 'Date conflicts with another log' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
        'Date conflicts with another log',
      );
    });
  });

  describe('page editing', () => {
    it('most recent log (last in array) has an editable range button', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('mat-list-item');
      const lastItem = items[items.length - 1];
      expect(lastItem.querySelector('button[aria-label="Edit progress range"]')).toBeTruthy();
    });

    it('non-most-recent logs show a plain span with no edit button', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const firstItem = fixture.nativeElement.querySelectorAll('mat-list-item')[0];
      expect(firstItem.querySelector('button[aria-label="Edit progress range"]')).toBeNull();
      expect(firstItem.querySelector('span.range')).toBeTruthy();
    });

    it('clicking the range button on the most recent log shows a number input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeTruthy();
    });

    it('submitting a pages log sends page_end then refreshes', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      input.value = '120';
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs/log-2');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ page_end: 120 });
      req.flush({ ...mockLogs[1], page_end: 120 });

      flushLoad();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeNull();
    });

    it('submitting a minutes log sends minute_end', () => {
      const minuteLog: ProgressLog = {
        ...mockLogs[1],
        unit: 'minutes',
        page_start: null,
        page_end: null,
        minute_start: 0,
        minute_end: 60,
      };
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad(mockEngagement, [mockLogs[0], minuteLog]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      input.value = '90';
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs/log-2');
      expect(req.request.body).toEqual({ minute_end: 90 });
      req.flush({ ...minuteLog, minute_end: 90 });

      flushLoad(mockEngagement, [mockLogs[0], minuteLog]);
      fixture.detectChanges();
    });

    it('pressing Escape on the number input cancels without a PATCH', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeNull();
    });

    it('shows the 409 error message under the number input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      input.value = '9999';
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      httpTesting
        .expectOne('/api/engagements/eng-1/progress-logs/log-2')
        .flush({ detail: 'Page exceeds book length' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
        'Page exceeds book length',
      );
    });
  });
});
