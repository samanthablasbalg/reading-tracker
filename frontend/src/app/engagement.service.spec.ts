import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EngagementService, localDateString } from './engagement.service';

describe('localDateString', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('EngagementService', () => {
  let service: EngagementService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EngagementService);
    httpTesting = TestBed.inject(HttpTestingController);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 30, 12, 0, 0));
  });

  afterEach(() => {
    httpTesting.verify();
    vi.useRealTimers();
  });

  it('markReading sends started_on as the local date and defaults to status reading', () => {
    service.markReading('book-1', 'print').subscribe();

    const req = httpTesting.expectOne('/api/engagements');
    expect(req.request.body).toEqual({
      book_id: 'book-1',
      edition_format: 'print',
      status: 'reading',
      started_on: '2026-06-30',
    });
    req.flush({});
  });

  it('markReading sends the given status', () => {
    service.markReading('book-1', 'print', undefined, 'finished').subscribe();

    const req = httpTesting.expectOne('/api/engagements');
    expect(req.request.body).toEqual({
      book_id: 'book-1',
      edition_format: 'print',
      status: 'finished',
      started_on: '2026-06-30',
    });
    req.flush({});
  });

  it('markFinished sends effective_on as the local date', () => {
    service.markFinished('eng-1').subscribe();

    const req = httpTesting.expectOne('/api/engagements/eng-1');
    expect(req.request.body).toEqual({ status: 'finished', effective_on: '2026-06-30' });
    req.flush({});
  });

  it('markDnf sends effective_on as the local date', () => {
    service.markDnf('eng-1').subscribe();

    const req = httpTesting.expectOne('/api/engagements/eng-1');
    expect(req.request.body).toEqual({ status: 'dnf', effective_on: '2026-06-30' });
    req.flush({});
  });

  it('logProgress sends logged_on as the local date alongside the payload', () => {
    service.logProgress('eng-1', { current_page: 120 }).subscribe();

    const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs');
    expect(req.request.body).toEqual({ current_page: 120, logged_on: '2026-06-30' });
    req.flush({});
  });

  it('logProgress sends the provided loggedOn instead of the local date', () => {
    service.logProgress('eng-1', { current_page: 120 }, '2026-06-10').subscribe();

    const req = httpTesting.expectOne('/api/engagements/eng-1/progress-logs');
    expect(req.request.body).toEqual({ current_page: 120, logged_on: '2026-06-10' });
    req.flush({});
  });
});
