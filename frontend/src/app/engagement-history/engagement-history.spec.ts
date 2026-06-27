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

  describe('engagement date editing', () => {
    it('clicking the started_on button shows a date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit start date"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="start date"]')).toBeTruthy();
    });

    it('saving started_on calls PATCH /dates then refreshes', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit start date"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="start date"]',
      ) as HTMLInputElement;
      input.value = '2025-12-01';
      fixture.nativeElement.querySelector('button[aria-label="Save start date"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/dates');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ started_on: '2025-12-01' });
      req.flush({ ...mockEngagement, started_on: '2025-12-01' });

      flushLoad();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="start date"]')).toBeNull();
    });

    it('pressing Escape on started_on input cancels without a PATCH', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit start date"]').click();
      fixture.detectChanges();

      fixture.nativeElement
        .querySelector('input[aria-label="start date"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="start date"]')).toBeNull();
    });

    it('shows 409 error under started_on input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit start date"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="start date"]',
      ) as HTMLInputElement;
      input.value = '2026-08-01';
      fixture.nativeElement.querySelector('button[aria-label="Save start date"]').click();
      fixture.detectChanges();

      httpTesting
        .expectOne('/api/engagements/eng-1/dates')
        .flush(
          { detail: 'started_on cannot be after the earliest progress log.' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
        'started_on cannot be after the earliest progress log.',
      );
    });

    it('clicking the finished_on button shows a date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit finish date"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="finish date"]')).toBeTruthy();
    });

    it('saving finished_on calls PATCH /dates with finished_on', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit finish date"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="finish date"]',
      ) as HTMLInputElement;
      input.value = '2026-07-01';
      fixture.nativeElement.querySelector('button[aria-label="Save finish date"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/dates');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ finished_on: '2026-07-01' });
      req.flush({ ...mockEngagement, finished_on: '2026-07-01' });

      flushLoad();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="finish date"]')).toBeNull();
    });
  });

  describe('log date editing', () => {
    it('clicking a log date button shows a date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const dateBtn = fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]');
      dateBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="Edit log date"]')).toBeTruthy();
    });

    it('saving a log date calls PATCH on the log then refreshes', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="Edit log date"]',
      ) as HTMLInputElement;
      input.value = '2026-02-01';
      fixture.nativeElement.querySelector('button[aria-label="Save date"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs/log-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ logged_at: '2026-02-01' });
      req.flush({ ...mockLogs[0], logged_at: '2026-02-01' });

      flushLoad();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="Edit log date"]')).toBeNull();
    });

    it('pressing Escape on the log date input cancels without a PATCH', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      fixture.nativeElement
        .querySelector('input[aria-label="Edit log date"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="Edit log date"]')).toBeNull();
    });

    it('shows a 409 error under the log date input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="Edit log date"]',
      ) as HTMLInputElement;
      input.value = '2026-02-01';
      fixture.nativeElement.querySelector('button[aria-label="Save date"]').click();
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

  describe('log page editing', () => {
    it('most recent log row has an editable range button', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.log-row');
      const lastRow = rows[rows.length - 1];
      expect(lastRow.querySelector('button[aria-label="Edit progress range"]')).toBeTruthy();
    });

    it('non-most-recent log rows show plain text with no edit button', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const firstRow = fixture.nativeElement.querySelectorAll('.log-row')[0];
      expect(firstRow.querySelector('button[aria-label="Edit progress range"]')).toBeNull();
    });

    it('clicking the range button shows a number input', () => {
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
      fixture.nativeElement.querySelector('button[aria-label="Save progress"]').click();
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
      fixture.nativeElement.querySelector('button[aria-label="Save progress"]').click();
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

      fixture.nativeElement
        .querySelector('input[type="number"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeNull();
    });

    it('shows a 409 error under the number input', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit progress range"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      input.value = '9999';
      fixture.nativeElement.querySelector('button[aria-label="Save progress"]').click();
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
