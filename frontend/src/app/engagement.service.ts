import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { EngagementsService as EngagementsApiService } from './api/generated/engagements/engagements.service';
import type {
  EngagementCreateStatus,
  EngagementRead,
  Format,
  MinuteProgressLogRead,
  PageProgressLogRead,
  ProgressLogCreate,
} from './api/generated/readingTracker.schemas';

export type {
  EngagementRead as Engagement,
  ReviewRead as Review,
} from './api/generated/readingTracker.schemas';
export type EngagementStatus = EngagementCreateStatus;
export type ProgressLog = PageProgressLogRead | MinuteProgressLogRead;

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly engagementsApi = inject(EngagementsApiService);
  private readonly cache = new Map<EngagementStatus, BehaviorSubject<EngagementRead[]>>();

  private subject(status: EngagementStatus): BehaviorSubject<EngagementRead[]> {
    if (!this.cache.has(status)) {
      this.cache.set(status, new BehaviorSubject<EngagementRead[]>([]));
    }
    return this.cache.get(status)!;
  }

  private fetch(status: EngagementStatus): void {
    this.engagementsApi
      .engagementsListEngagements({ status })
      .subscribe((list) => this.subject(status).next(list));
  }

  engagements(status: EngagementStatus): Observable<EngagementRead[]> {
    const subject = this.subject(status);
    this.fetch(status);
    return subject.asObservable();
  }

  reloadEngagements(): void {
    this.cache.forEach((_, status) => this.fetch(status));
  }

  patchEngagementInPlace(id: string, patch: Partial<EngagementRead>): void {
    const subject = this.cache.get('reading');
    if (subject) {
      subject.next(subject.value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }
  }

  markReading(
    bookId: string,
    format = 'print',
    audioLengthMinutes?: number,
    status: EngagementStatus = 'reading',
  ): Observable<EngagementRead> {
    return this.engagementsApi.engagementsCreateEngagement({
      book_id: bookId,
      edition_format: format as Format,
      status,
      started_on: localDateString(),
      ...(audioLengthMinutes != null && { audio_length_minutes: audioLengthMinutes }),
    });
  }

  markFinished(engagementId: string): Observable<EngagementRead> {
    return this.engagementsApi.engagementsUpdateEngagementStatus(engagementId, {
      status: 'finished',
      effective_on: localDateString(),
    });
  }

  markDnf(engagementId: string): Observable<EngagementRead> {
    return this.engagementsApi.engagementsUpdateEngagementStatus(engagementId, {
      status: 'dnf',
      effective_on: localDateString(),
    });
  }

  logProgress(
    engagementId: string,
    payload: Record<string, number>,
    loggedOn?: string,
  ): Observable<PageProgressLogRead | MinuteProgressLogRead> {
    return this.engagementsApi.engagementsLogProgress(engagementId, {
      ...payload,
      logged_on: loggedOn ?? localDateString(),
    } as ProgressLogCreate);
  }

  getEngagement(id: string): Observable<EngagementRead> {
    return this.engagementsApi.engagementsGetEngagement(id);
  }

  getProgressLogs(id: string): Observable<ProgressLog[]> {
    return this.engagementsApi.engagementsListProgressLogs(id);
  }

  patchProgressLog(
    engagementId: string,
    logId: string,
    patch: { logged_on?: string; page_end?: number; minute_end?: number },
  ): Observable<ProgressLog> {
    return this.engagementsApi.engagementsUpdateProgressLog(engagementId, logId, patch);
  }

  deleteProgressLog(engagementId: string, logId: string): Observable<void> {
    return this.engagementsApi.engagementsDeleteProgressLog(engagementId, logId);
  }

  deleteEngagement(id: string): Observable<void> {
    return this.engagementsApi.engagementsDeleteEngagement(id);
  }

  patchEngagementDates(
    id: string,
    patch: { started_on?: string; finished_on?: string },
  ): Observable<EngagementRead> {
    return this.engagementsApi.engagementsUpdateEngagementDates(id, patch);
  }

  upsertReview(
    engagementId: string,
    rating: number | null,
    body: string | null,
  ): Observable<EngagementRead> {
    return this.engagementsApi.engagementsUpsertReview(engagementId, { rating, body });
  }
}
