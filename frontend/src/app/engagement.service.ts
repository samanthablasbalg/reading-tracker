import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Book } from './book.service';

export type EngagementStatus = 'reading' | 'finished' | 'dnf';

export type EngagedBook = Pick<
  Book,
  'id' | 'title' | 'authors' | 'default_page_count' | 'default_audio_minutes'
>;

export interface Review {
  rating: string | null;
  body: string | null;
}

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ProgressLog {
  id: string;
  engagement_id: string;
  logged_on: string;
  unit: 'pages' | 'minutes';
  page_start: number | null;
  page_end: number | null;
  minute_start: number | null;
  minute_end: number | null;
  new_ground: boolean;
}

export interface Engagement {
  id: string;
  book: EngagedBook;
  formats: string[];
  cover_url: string | null;
  status: EngagementStatus;
  started_on: string | null;
  finished_on: string | null;
  abandoned_on: string | null;
  resume_from_page: number;
  resume_from_minute: number;
  completion_pct: number | null;
  review: Review | null;
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<EngagementStatus, BehaviorSubject<Engagement[]>>();

  private subject(status: EngagementStatus): BehaviorSubject<Engagement[]> {
    if (!this.cache.has(status)) {
      this.cache.set(status, new BehaviorSubject<Engagement[]>([]));
    }
    return this.cache.get(status)!;
  }

  private fetch(status: EngagementStatus): void {
    this.http
      .get<Engagement[]>('/api/engagements', { params: { status } })
      .subscribe((list) => this.subject(status).next(list));
  }

  engagements(status: EngagementStatus): Observable<Engagement[]> {
    const subject = this.subject(status);
    this.fetch(status);
    return subject.asObservable();
  }

  reloadEngagements(): void {
    this.cache.forEach((_, status) => this.fetch(status));
  }

  patchEngagementInPlace(id: string, patch: Partial<Engagement>): void {
    const subject = this.cache.get('reading');
    if (subject) {
      subject.next(subject.value.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }
  }

  markReading(
    bookId: string,
    format = 'print',
    audioLengthMinutes?: number,
  ): Observable<Engagement> {
    return this.http.post<Engagement>('/api/engagements', {
      book_id: bookId,
      edition_format: format,
      started_on: localDateString(),
      ...(audioLengthMinutes != null && { audio_length_minutes: audioLengthMinutes }),
    });
  }

  markFinished(engagementId: string): Observable<Engagement> {
    return this.http.patch<Engagement>(`/api/engagements/${engagementId}`, {
      status: 'finished',
      effective_on: localDateString(),
    });
  }

  markDnf(engagementId: string): Observable<Engagement> {
    return this.http.patch<Engagement>(`/api/engagements/${engagementId}`, {
      status: 'dnf',
      effective_on: localDateString(),
    });
  }

  logProgress(
    engagementId: string,
    payload: Record<string, number>,
    loggedOn?: string,
  ): Observable<unknown> {
    return this.http.post<unknown>(`/api/engagements/${engagementId}/progress-logs`, {
      ...payload,
      logged_on: loggedOn ?? localDateString(),
    });
  }

  getEngagement(id: string): Observable<Engagement> {
    return this.http.get<Engagement>(`/api/engagements/${id}`);
  }

  getProgressLogs(id: string): Observable<ProgressLog[]> {
    return this.http.get<ProgressLog[]>(`/api/engagements/${id}/progress-logs`);
  }

  patchProgressLog(
    engagementId: string,
    logId: string,
    patch: { logged_on?: string; page_end?: number; minute_end?: number },
  ): Observable<ProgressLog> {
    return this.http.patch<ProgressLog>(
      `/api/engagements/${engagementId}/progress-logs/${logId}`,
      patch,
    );
  }

  patchEngagementDates(
    id: string,
    patch: { started_on?: string; finished_on?: string },
  ): Observable<Engagement> {
    return this.http.patch<Engagement>(`/api/engagements/${id}/dates`, patch);
  }

  upsertReview(
    engagementId: string,
    rating: number | null,
    body: string | null,
  ): Observable<Engagement> {
    return this.http.put<Engagement>(`/api/engagements/${engagementId}/review`, { rating, body });
  }
}
