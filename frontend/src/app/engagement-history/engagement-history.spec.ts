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
    google_books_id: null,
    default_cover_url: null,
    default_page_count: 412,
    default_audio_minutes: 0,
    original_language: null,
    genres: [],
    publication_date: null,
    publication_date_precision: 'day',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockLogs: ProgressLog[] = [
  {
    id: 'log-1',
    engagement_id: 'eng-1',
    logged_on: '2026-01-01',
    type: 'page',
    page_start: 1,
    page_end: 50,
    new_ground: true,
  },
  {
    id: 'log-2',
    engagement_id: 'eng-1',
    logged_on: '2026-01-10',
    type: 'page',
    page_start: 51,
    page_end: 100,
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

    it('shows 409 error below the dates line', () => {
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

    it('opening a log date edit is blocked while a start/finish date is being edited', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Edit start date"]').click();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[aria-label="Edit log date"]')).toBeNull();
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
      expect(req.request.body).toEqual({ logged_on: '2026-02-01' });
      req.flush({ ...mockLogs[0], logged_on: '2026-02-01' });

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

    it('log date input is bounded to today as the max', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 30, 12, 0, 0));

      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label^="Edit date:"]').click();
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[aria-label="Edit log date"]',
      ) as HTMLInputElement;
      expect(input.max).toBe('2026-06-30');

      vi.useRealTimers();
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

  describe('log deletion', () => {
    it('only the most recent log row has a delete button', () => {
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.log-row');
      expect(rows[0].querySelector('button[aria-label="Delete progress log"]')).toBeNull();
      expect(rows[1].querySelector('button[aria-label="Delete progress log"]')).toBeTruthy();
    });

    it('declining the confirm dialog sends no request', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete progress log"]').click();
      fixture.detectChanges();

      httpTesting.expectNone('/api/engagements/eng-1/progress-logs/log-2');
    });

    it('confirming calls DELETE on the log then refreshes', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete progress log"]').click();
      fixture.detectChanges();

      const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs/log-2');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      flushLoad(mockEngagement, [mockLogs[0]]);
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.log-row');
      expect(rows.length).toBe(1);
    });

    it('shows a 409 error when deletion is rejected', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('button[aria-label="Delete progress log"]').click();
      fixture.detectChanges();

      httpTesting
        .expectOne('/api/engagements/eng-1/progress-logs/log-2')
        .flush(
          { detail: 'Only the most recent progress log can be deleted.' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
        'Only the most recent progress log can be deleted.',
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

    it('audio log range shows h:mm timestamps', () => {
      const minuteLog: ProgressLog = {
        id: mockLogs[0].id,
        engagement_id: mockLogs[0].engagement_id,
        logged_on: mockLogs[0].logged_on,
        new_ground: mockLogs[0].new_ground,
        type: 'minute',
        minute_start: 0,
        minute_end: 110,
      };
      const fixture = TestBed.createComponent(EngagementHistoryComponent);
      flushLoad(mockEngagement, [minuteLog]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('0:00–1:50');
    });

    it('submitting a minutes log sends minute_end', () => {
      const minuteLog: ProgressLog = {
        id: mockLogs[1].id,
        engagement_id: mockLogs[1].engagement_id,
        logged_on: mockLogs[1].logged_on,
        new_ground: mockLogs[1].new_ground,
        type: 'minute',
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
